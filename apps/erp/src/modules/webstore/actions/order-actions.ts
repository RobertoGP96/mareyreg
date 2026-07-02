"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import { reverseInvoiceStock } from "@/modules/sales/lib/dispatch-lines";
import { webstoreOrderPayloadSchema } from "../lib/schemas";
import { processWebstoreOrder, NeedsReviewError } from "../lib/process-order";

const FORBIDDEN_ERROR_MESSAGE = "No tienes permisos para realizar esta acción";
const AUTH_ERROR_MESSAGE = "No autenticado";
const SESSION_ERROR_RESPONSE =
  "Tu sesión expiró o no iniciaste sesión. Vuelve a iniciar sesión e intenta de nuevo.";

// Whitelist de errores de negocio conocidos (mensajes ya en español, seguros
// de mostrar al usuario tal cual). Cualquier otro error se reemplaza por un
// mensaje generico para no filtrar detalles internos (stack, SQL, etc.).
function toUserMessage(error: unknown, genericMessage: string): string {
  if (error instanceof Error) {
    if (error.message === AUTH_ERROR_MESSAGE) return SESSION_ERROR_RESPONSE;
    if (
      error.message === "Orden no encontrada" ||
      error.message === "La orden no está procesada, no se puede cancelar" ||
      error.message === "La orden ya fue cancelada o está siendo cancelada" ||
      error.message.startsWith("No se pudo determinar el almacén de origen")
    ) {
      return error.message;
    }
  }
  return genericMessage;
}

/**
 * Claim atómico previo al procesamiento: el enum WebstoreOrderStatus no tiene
 * un valor "processing" (no se modifica schema.prisma en este cambio), así que
 * reutilizamos "received" como estado transitorio de "en proceso". Es seguro
 * porque "received" ya significa "en la cola, sin resolver" en la UI (badge
 * "Recibida"/pending) y no aparece en los contadores de needs_review/error/
 * processed del dashboard. El updateMany condicionado por status actúa como
 * compare-and-swap: sólo una llamada concurrente gana el claim.
 */
async function claimOrderForProcessing(logId: number): Promise<boolean> {
  const claim = await db.webstoreOrderLog.updateMany({
    where: { logId, status: { in: ["needs_review", "error"] } },
    data: { status: "received" },
  });
  return claim.count === 1;
}

async function restoreOrderStatus(logId: number, status: "needs_review" | "error", message: string) {
  await db.webstoreOrderLog.update({
    where: { logId },
    data: { status, errorMessage: message },
  });
}

export async function reprocessOrder(
  logId: number,
  overrides?: Record<string, number>
): Promise<ActionResult<{ salesOrderId: number; invoiceId: number; folio: string }>> {
  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");

    const log = await db.webstoreOrderLog.findUnique({ where: { logId } });
    if (!log) return { success: false, error: "Orden no encontrada" };
    if (log.status === "processed") {
      return { success: false, error: "Esta orden ya fue procesada" };
    }

    const parsed = webstoreOrderPayloadSchema.safeParse(log.rawPayload);
    if (!parsed.success) {
      return { success: false, error: "El payload guardado no es válido" };
    }

    const claimed = await claimOrderForProcessing(logId);
    if (!claimed) {
      return { success: false, error: "La orden ya fue procesada o está en proceso" };
    }

    try {
      const result = await processWebstoreOrder(logId, parsed.data, overrides, { userId });
      revalidatePath("/webstore/ordenes");
      revalidatePath(`/webstore/ordenes/${logId}`);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof NeedsReviewError) {
        await restoreOrderStatus(logId, "needs_review", error.message);
        revalidatePath(`/webstore/ordenes/${logId}`);
        return { success: false, error: error.message };
      }
      console.error("Error reprocessing webstore order:", error);
      await restoreOrderStatus(logId, "error", "Error al reprocesar la orden");
      revalidatePath(`/webstore/ordenes/${logId}`);
      return { success: false, error: "Error al reprocesar la orden" };
    }
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    console.error("Error reprocessing webstore order:", error);
    return { success: false, error: "Error al reprocesar la orden" };
  }
}

/**
 * Cancela una orden web ya procesada: revierte stock/valuación, pagos
 * registrados y el efecto en el saldo del cliente, y marca la factura y el
 * log como cancelados. Todo ocurre dentro de una única transacción; el claim
 * atómico inicial (`updateMany` condicionado a `status: "processed"`) evita
 * una doble cancelación concurrente — si otra llamada ya ganó el claim, esta
 * falla con "La orden ya fue cancelada o está siendo cancelada" antes de
 * tocar stock/balance.
 *
 * Manejo de pagos: `processWebstoreOrder` puede haber registrado un
 * `InvoicePayment` al procesar la orden (pago online). Al crear la factura
 * incrementó `Customer.currentBalance` por el total y, si hubo pago, lo
 * decrementó por el monto pagado. Para dejar el saldo neto como antes de la
 * orden, el reverso decrementa por el total de la factura e incrementa por
 * la suma de pagos registrados (inverso exacto, en cualquier orden se anula
 * igual). Los `InvoicePayment` no se eliminan (preserva el registro
 * auditable); en su lugar quedan huérfanos de una factura `cancelled`, igual
 * de trazables que el resto del historial de la factura.
 */
export async function cancelWebstoreOrder(logId: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");

    await db.$transaction(async (tx) => {
      // Claim atómico: sólo una llamada concurrente pasa de "processed" a
      // "cancelled". Si count === 0, alguien más ya la canceló (o nunca
      // estuvo "processed"), y no se toca nada más.
      const claim = await tx.webstoreOrderLog.updateMany({
        where: { logId, status: "processed" },
        data: { status: "cancelled" },
      });
      if (claim.count === 0) {
        const existing = await tx.webstoreOrderLog.findUnique({ where: { logId } });
        if (!existing) throw new Error("Orden no encontrada");
        if (existing.status === "cancelled") {
          throw new Error("La orden ya fue cancelada o está siendo cancelada");
        }
        throw new Error("La orden no está procesada, no se puede cancelar");
      }

      const log = await tx.webstoreOrderLog.findUniqueOrThrow({
        where: { logId },
        include: {
          salesOrder: true,
          invoice: { include: { lines: true, payments: true } },
        },
      });
      if (!log.salesOrder || !log.invoice) {
        throw new Error("La orden no tiene factura u orden de venta asociada");
      }

      const invoice = log.invoice;
      const warehouseId = log.salesOrder.warehouseId;
      const warehouseByProductId = new Map<number, number>();
      for (const line of invoice.lines) {
        warehouseByProductId.set(line.productId, warehouseId);
      }

      const reversedLines = await reverseInvoiceStock(tx, {
        folio: invoice.folio,
        warehouseByProductId,
        lines: invoice.lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost),
          lotId: l.lotId,
        })),
        userId,
        movementNotesPrefix: "Cancelación orden web",
      });

      // Saldo del cliente: reverso exacto de lo que hizo processWebstoreOrder
      // al crear la orden (incrementó por el total) y, si hubo pago,
      // (decrementó por el monto pagado). netChange < 0 implica que el
      // reverso debe ser un incremento neto (más frecuente: total > pagado).
      const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const netChange = Number(invoice.total) - totalPaid;
      if (netChange !== 0) {
        await tx.customer.update({
          where: { customerId: invoice.customerId },
          data: { currentBalance: { decrement: netChange } },
        });
      }

      await tx.invoice.update({
        where: { invoiceId: invoice.invoiceId },
        data: { status: "cancelled" },
      });

      await tx.webstoreOrderLog.update({
        where: { logId },
        data: {
          errorMessage: `Orden cancelada manualmente el ${new Date().toISOString()}`,
        },
      });

      await createAuditLog(tx, {
        action: "cancel",
        entityType: "WebstoreOrderLog",
        entityId: logId,
        module: "webstore",
        userId,
        oldValues: {
          invoiceStatus: invoice.status,
          invoiceTotal: Number(invoice.total),
          invoicePaid: Number(invoice.paid),
          payments: invoice.payments.map((p) => ({ paymentId: p.paymentId, amount: Number(p.amount) })),
        },
        newValues: {
          salesOrderId: log.salesOrder.orderId,
          invoiceId: invoice.invoiceId,
          stockReversal: reversedLines,
          customerBalanceChange: -netChange,
        },
      });
    });

    revalidatePath("/webstore/ordenes");
    revalidatePath(`/webstore/ordenes/${logId}`);
    revalidatePath("/invoices");
    revalidatePath("/stock");
    revalidatePath("/accounts-receivable");
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    console.error("Error cancelling webstore order:", error);
    const msg = toUserMessage(error, "Error al cancelar la orden");
    return { success: false, error: msg };
  }
}
