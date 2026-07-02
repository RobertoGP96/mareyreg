import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

/**
 * Parsea una fecha "YYYY-MM-DD" (la que produce <input type="date">) como
 * fin de dia LOCAL (23:59:59.999), no UTC. `new Date("YYYY-MM-DD")` interpreta
 * el string como medianoche UTC, lo cual corre la fecha un dia hacia atras en
 * zonas horarias negativas (America/Mexico_City = UTC-6). Construir con
 * componentes evita ese corrimiento.
 */
export function endOfLocalDay(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  // Guarda contra desbordes como 2026-02-31 -> marzo
  if (date.getMonth() !== month - 1) return null;
  return date;
}

const EXPIRE_BATCH_SIZE = 50;

/**
 * Expiracion perezosa: no hay cron. Se llama al inicio de las lecturas
 * principales del modulo (lista de reservaciones, disponibilidad, dashboard)
 * de forma no bloqueante para el caller (try/catch en el llamador).
 *
 * Busca reservas activas vencidas (expiresAt < now, con fallback a
 * expirationDate parseable y vencida cuando expiresAt es null — filas viejas
 * antes del backfill), y por cada una: marca `expired` con claim atomico
 * (updateMany where status=active) y libera inventario con el patron
 * condicional del modulo (reserved >= quantity). Una transaccion por reserva
 * para no bloquear el resto del batch si una falla.
 */
export async function expireOverdueReservations(): Promise<{ expired: number }> {
  const now = new Date();

  const candidates = await db.pacaReservation.findMany({
    where: {
      status: "active",
      OR: [{ expiresAt: { lt: now } }, { expiresAt: null, expirationDate: { not: null } }],
    },
    select: {
      reservationId: true,
      expiresAt: true,
      expirationDate: true,
    },
    take: EXPIRE_BATCH_SIZE,
  });

  let expiredCount = 0;

  for (const candidate of candidates) {
    const effectiveExpiry =
      candidate.expiresAt ?? (candidate.expirationDate ? endOfLocalDay(candidate.expirationDate) : null);

    if (!effectiveExpiry || effectiveExpiry >= now) continue;

    try {
      await db.$transaction(async (tx) => {
        const reservation = await tx.pacaReservation.findUnique({
          where: { reservationId: candidate.reservationId },
        });
        if (!reservation) return;

        const claimed = await tx.pacaReservation.updateMany({
          where: { reservationId: candidate.reservationId, status: "active" },
          data: { status: "expired" },
        });
        if (claimed.count !== 1) return;

        const released = await tx.pacaInventory.updateMany({
          where: { categoryId: reservation.categoryId, reserved: { gte: reservation.quantity } },
          data: {
            reserved: { decrement: reservation.quantity },
            available: { increment: reservation.quantity },
          },
        });
        if (released.count !== 1) {
          throw new Error("No se pudo liberar el inventario: inconsistencia de reservado");
        }

        await createAuditLog(tx, {
          action: "expire",
          entityType: "PacaReservation",
          entityId: reservation.reservationId,
          module: "pacas",
          userId: null,
          oldValues: reservation,
          newValues: { status: "expired", expiredAt: now.toISOString() },
        });
      });

      expiredCount++;
    } catch (error) {
      console.error(`expireOverdueReservations: fallo al expirar #${candidate.reservationId}:`, error);
    }
  }

  return { expired: expiredCount };
}

/**
 * Envoltura no bloqueante para llamar desde queries de lectura: si la
 * expiracion falla, la lectura debe continuar sin interrumpirse.
 */
export async function tryExpireOverdueReservations(): Promise<void> {
  try {
    await expireOverdueReservations();
  } catch (error) {
    console.error("tryExpireOverdueReservations:", error);
  }
}
