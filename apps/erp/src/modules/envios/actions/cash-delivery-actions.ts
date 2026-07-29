"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole } from "@/lib/auth-guard";
import { cashDeliverySchema, type CashDeliveryInput } from "../lib/schemas";
import {
  describeDeliveryDbError,
  resolveDeliveryLines,
  type ResolvedDeliveryLine,
} from "../lib/delivery-lines";

const AUTH_ERROR_MESSAGE = "Debes iniciar sesión para realizar esta acción.";
const STALE_ERROR_MESSAGE =
  "La entrega cambió mientras la editabas. Recarga la página e intenta de nuevo.";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

// CashDelivery afecta su propio listado, el dashboard (entregas y comisiones
// pendientes) y el reporte por mensajero.
const revalidateCashDeliveries = () => {
  revalidatePath("/envios/entregas");
  revalidatePath("/envios/dashboard");
  revalidatePath("/envios/mensajeros");
};

function parseOccurredAt(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const DELIVERY_TREE_INCLUDE = {
  lines: { include: { denominations: true } },
} as const;

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function writeLines(tx: Tx, deliveryId: number, lines: ResolvedDeliveryLine[]) {
  for (const [index, line] of lines.entries()) {
    const created = await tx.cashDeliveryLine.create({
      data: {
        deliveryId,
        currencyId: line.currencyId,
        amount: line.amount.toString(),
        sortOrder: index,
      },
    });
    await tx.cashDeliveryLineDenomination.createMany({
      data: line.denominations.map((d) => ({
        lineId: created.lineId,
        denominationId: d.denominationId,
        quantity: d.quantity,
        unitValue: d.unitValue.toString(),
      })),
    });
  }
}

async function assertCourierUsable(tx: Tx, courierId: number | null | undefined) {
  if (courierId == null) return;
  const courier = await tx.courierProfile.findUnique({
    where: { courierProfileId: courierId },
    select: { active: true },
  });
  if (!courier) throw new Error("Mensajero no encontrado");
  if (!courier.active) throw new Error("El mensajero está desactivado");
}

export async function createCashDelivery(
  input: CashDeliveryInput
): Promise<ActionResult<{ deliveryId: number }>> {
  try {
    const parsed = cashDeliverySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;
    const userId = await requireCurrentUserId();

    const created = await db.$transaction(async (tx) => {
      const recipient = await tx.recipient.findUnique({
        where: { recipientId: data.recipientId },
        select: { active: true },
      });
      if (!recipient) throw new Error("Destinatario no encontrado");
      if (!recipient.active) throw new Error("El destinatario está desactivado");

      await assertCourierUsable(tx, data.courierId);
      const lines = await resolveDeliveryLines(tx, data.lines);

      const delivery = await tx.cashDelivery.create({
        data: {
          recipientId: data.recipientId,
          status: "pending",
          courierId: data.courierId ?? null,
          commissionAmount: data.commissionAmount.toString(),
          commissionCurrencyId: data.commissionCurrencyId ?? null,
          commissionStatus: "pending",
          photoUrl: data.photoUrl?.trim() || null,
          reference: data.reference?.trim() || null,
          notes: data.notes?.trim() || null,
          occurredAt: parseOccurredAt(data.occurredAt),
          createdById: userId,
        },
      });

      await writeLines(tx, delivery.deliveryId, lines);

      await createAuditLog(tx, {
        action: "create",
        entityType: "CashDelivery",
        entityId: delivery.deliveryId,
        module: "envios",
        userId,
        newValues: { ...data, lines },
      });

      return delivery;
    });

    revalidateCashDeliveries();
    return { success: true, data: { deliveryId: created.deliveryId } };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("createCashDelivery:", error);
    return {
      success: false,
      error: describeDeliveryDbError(
        error,
        error instanceof Error ? error.message : "Error al registrar la entrega"
      ),
    };
  }
}

export async function updateCashDelivery(
  id: number,
  input: CashDeliveryInput
): Promise<ActionResult<void>> {
  try {
    const parsed = cashDeliverySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;
    const userId = await requireCurrentUserId();

    await db.$transaction(async (tx) => {
      const prev = await tx.cashDelivery.findUnique({
        where: { deliveryId: id },
        include: DELIVERY_TREE_INCLUDE,
      });
      if (!prev) throw new Error("Entrega no encontrada");
      if (prev.status !== "pending") {
        throw new Error("Solo se pueden editar entregas pendientes");
      }

      await assertCourierUsable(tx, data.courierId);
      const lines = await resolveDeliveryLines(tx, data.lines);

      // Subir la versión ANTES de borrar nada: si otro editor ya guardó, este
      // pierde la carrera sin haber destruido sus líneas.
      const claimed = await tx.cashDelivery.updateMany({
        where: { deliveryId: id, version: prev.version, status: "pending" },
        data: {
          recipientId: data.recipientId,
          courierId: data.courierId ?? null,
          commissionAmount: data.commissionAmount.toString(),
          commissionCurrencyId: data.commissionCurrencyId ?? null,
          photoUrl: data.photoUrl?.trim() || null,
          reference: data.reference?.trim() || null,
          notes: data.notes?.trim() || null,
          occurredAt: parseOccurredAt(data.occurredAt) ?? prev.occurredAt,
          version: { increment: 1 },
        },
      });
      if (claimed.count === 0) throw new Error(STALE_ERROR_MESSAGE);

      await tx.cashDeliveryLineDenomination.deleteMany({ where: { line: { deliveryId: id } } });
      await tx.cashDeliveryLine.deleteMany({ where: { deliveryId: id } });
      await writeLines(tx, id, lines);

      await createAuditLog(tx, {
        action: "update",
        entityType: "CashDelivery",
        entityId: id,
        module: "envios",
        userId,
        oldValues: prev,
        newValues: { ...data, lines },
      });
    });

    revalidateCashDeliveries();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("updateCashDelivery:", error);
    return {
      success: false,
      error: describeDeliveryDbError(
        error,
        error instanceof Error ? error.message : "Error al actualizar la entrega"
      ),
    };
  }
}

export async function markCashDeliveryDelivered(
  id: number,
  photoUrl?: string | null
): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.cashDelivery.findUnique({ where: { deliveryId: id } });
      if (!prev) throw new Error("Entrega no encontrada");
      if (prev.status !== "pending") {
        throw new Error("Solo se pueden confirmar entregas pendientes");
      }
      const claimed = await tx.cashDelivery.updateMany({
        where: { deliveryId: id, version: prev.version, status: "pending" },
        data: {
          status: "delivered",
          deliveredAt: new Date(),
          confirmedById: userId,
          ...(photoUrl !== undefined && { photoUrl: photoUrl?.trim() || null }),
          version: { increment: 1 },
        },
      });
      if (claimed.count === 0) throw new Error(STALE_ERROR_MESSAGE);

      await createAuditLog(tx, {
        action: "update",
        entityType: "CashDelivery",
        entityId: id,
        module: "envios",
        userId,
        oldValues: { status: prev.status },
        newValues: { status: "delivered" },
      });
    });
    revalidateCashDeliveries();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("markCashDeliveryDelivered:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al marcar como entregada",
    };
  }
}

export async function cancelCashDelivery(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.cashDelivery.findUnique({ where: { deliveryId: id } });
      if (!prev) throw new Error("Entrega no encontrada");
      if (prev.status !== "pending") {
        throw new Error("Solo se pueden cancelar entregas pendientes");
      }

      // Cancelar revierte la comisión: la entrega no ocurrió, así que el pago
      // registrado al mensajero deja de estar respaldado.
      const revertsCommission = prev.commissionStatus === "paid";

      const claimed = await tx.cashDelivery.updateMany({
        where: { deliveryId: id, version: prev.version, status: "pending" },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
          ...(revertsCommission && {
            commissionStatus: "pending",
            commissionPaidAt: null,
            commissionPaidById: null,
          }),
          version: { increment: 1 },
        },
      });
      if (claimed.count === 0) throw new Error(STALE_ERROR_MESSAGE);

      await createAuditLog(tx, {
        action: "update",
        entityType: "CashDelivery",
        entityId: id,
        module: "envios",
        userId,
        oldValues: { status: prev.status },
        newValues: { status: "cancelled" },
      });

      if (revertsCommission) {
        await createAuditLog(tx, {
          action: "commission_reverted",
          entityType: "CashDelivery",
          entityId: id,
          module: "envios",
          userId,
          oldValues: {
            commissionStatus: "paid",
            commissionPaidAt: prev.commissionPaidAt,
            commissionPaidById: prev.commissionPaidById,
          },
          newValues: { commissionStatus: "pending", reason: "delivery_cancelled" },
        });
      }
    });
    revalidateCashDeliveries();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("cancelCashDelivery:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al cancelar la entrega",
    };
  }
}

export async function deleteCashDelivery(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      // El árbol completo va al audit antes de borrar: las líneas y su desglose
      // se van en cascada y esta es la única traza que queda.
      const prev = await tx.cashDelivery.findUnique({
        where: { deliveryId: id },
        include: DELIVERY_TREE_INCLUDE,
      });
      if (!prev) throw new Error("Entrega no encontrada");
      if (prev.status === "delivered") {
        throw new Error("No se pueden eliminar entregas ya confirmadas");
      }
      await tx.cashDelivery.delete({ where: { deliveryId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "CashDelivery",
        entityId: id,
        module: "envios",
        userId,
        oldValues: prev,
      });
    });
    revalidateCashDeliveries();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("deleteCashDelivery:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al eliminar la entrega",
    };
  }
}

export async function markDeliveryCommissionPaid(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.cashDelivery.findUnique({
        where: { deliveryId: id },
        select: {
          status: true,
          commissionStatus: true,
          commissionAmount: true,
          courierId: true,
        },
      });
      if (!prev) throw new Error("Entrega no encontrada");
      if (prev.status === "cancelled") {
        throw new Error("La entrega está cancelada");
      }
      if (prev.commissionAmount.toNumber() <= 0 || prev.courierId == null) {
        throw new Error("Esta entrega no tiene comisión asignada");
      }

      // El predicado de estado hace la operación idempotente frente a carreras:
      // el segundo en llegar obtiene count === 0.
      const claimed = await tx.cashDelivery.updateMany({
        where: { deliveryId: id, commissionStatus: "pending" },
        data: {
          commissionStatus: "paid",
          commissionPaidAt: new Date(),
          commissionPaidById: userId,
          version: { increment: 1 },
        },
      });
      if (claimed.count === 0) throw new Error("La comisión ya está marcada como pagada");

      await createAuditLog(tx, {
        action: "commission_paid",
        entityType: "CashDelivery",
        entityId: id,
        module: "envios",
        userId,
        oldValues: { commissionStatus: "pending" },
        newValues: { commissionStatus: "paid" },
      });
    });
    revalidateCashDeliveries();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("markDeliveryCommissionPaid:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al marcar la comisión como pagada",
    };
  }
}

export async function markDeliveryCommissionPending(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    // Revertir un pago ya registrado es un hecho financiero: solo admin.
    await assertRole("admin");

    await db.$transaction(async (tx) => {
      const claimed = await tx.cashDelivery.updateMany({
        where: { deliveryId: id, commissionStatus: "paid" },
        data: {
          commissionStatus: "pending",
          commissionPaidAt: null,
          commissionPaidById: null,
          version: { increment: 1 },
        },
      });
      if (claimed.count === 0) throw new Error("La comisión no está marcada como pagada");

      await createAuditLog(tx, {
        action: "commission_reverted",
        entityType: "CashDelivery",
        entityId: id,
        module: "envios",
        userId,
        oldValues: { commissionStatus: "paid" },
        newValues: { commissionStatus: "pending", reason: "manual" },
      });
    });
    revalidateCashDeliveries();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("markDeliveryCommissionPending:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al revertir la comisión",
    };
  }
}

/**
 * Marca varias comisiones como pagadas. Cada entrega va en su propia
 * transacción: un fallo (ya pagada, cancelada, sin comisión) se reporta sin
 * abortar el resto del lote — mismo contrato que bulkConfirmOperations.
 */
export async function bulkMarkCommissionPaid(
  ids: number[]
): Promise<ActionResult<{ paid: number; failed: { id: number; error: string }[] }>> {
  try {
    await requireCurrentUserId();
    const failed: { id: number; error: string }[] = [];
    let paid = 0;

    for (const id of ids) {
      const result = await markDeliveryCommissionPaid(id);
      if (result.success) paid += 1;
      else failed.push({ id, error: result.error });
    }

    revalidateCashDeliveries();
    return { success: true, data: { paid, failed } };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("bulkMarkCommissionPaid:", error);
    return { success: false, error: "Error al marcar las comisiones" };
  }
}
