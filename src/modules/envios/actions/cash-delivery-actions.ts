"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId, requireCurrentUserId } from "@/lib/audit";
import { cashDeliverySchema, type CashDeliveryInput } from "../lib/schemas";

const revalidateAll = () => {
  revalidatePath("/envios/entregas");
  revalidatePath("/envios/dashboard");
};

function parseOccurredAt(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
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

    const recipient = await db.recipient.findUnique({
      where: { recipientId: data.recipientId },
      select: { recipientId: true, active: true },
    });
    if (!recipient) return { success: false, error: "Destinatario no encontrado" };
    if (!recipient.active) {
      return { success: false, error: "El destinatario está desactivado" };
    }

    const currency = await db.currency.findUnique({
      where: { currencyId: data.currencyId },
      select: { currencyId: true, active: true },
    });
    if (!currency || !currency.active) {
      return { success: false, error: "Moneda inválida o desactivada" };
    }

    const created = await db.$transaction(async (tx) => {
      const d = await tx.cashDelivery.create({
        data: {
          recipientId: data.recipientId,
          currencyId: data.currencyId,
          amount: data.amount.toString(),
          status: "pending",
          reference: data.reference?.trim() || null,
          notes: data.notes?.trim() || null,
          occurredAt: parseOccurredAt(data.occurredAt),
          createdById: userId,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "CashDelivery",
        entityId: d.deliveryId,
        module: "envios",
        userId,
        newValues: data,
      });
      return d;
    });

    revalidateAll();
    return { success: true, data: { deliveryId: created.deliveryId } };
  } catch (error) {
    console.error("createCashDelivery:", error);
    return { success: false, error: "Error al registrar la entrega" };
  }
}

export async function updateCashDelivery(
  id: number,
  input: Partial<CashDeliveryInput>
): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.cashDelivery.findUnique({ where: { deliveryId: id } });
      if (!prev) throw new Error("Entrega no encontrada");
      if (prev.status !== "pending") {
        throw new Error("Solo se pueden editar entregas pendientes");
      }
      await tx.cashDelivery.update({
        where: { deliveryId: id },
        data: {
          ...(input.recipientId !== undefined && { recipientId: input.recipientId }),
          ...(input.currencyId !== undefined && { currencyId: input.currencyId }),
          ...(input.amount !== undefined && { amount: input.amount.toString() }),
          ...(input.reference !== undefined && { reference: input.reference?.trim() || null }),
          ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
          ...(input.occurredAt !== undefined && {
            occurredAt: parseOccurredAt(input.occurredAt) ?? prev.occurredAt,
          }),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "CashDelivery",
        entityId: id,
        module: "envios",
        userId,
        oldValues: prev,
        newValues: input,
      });
    });

    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Solo se pueden editar entregas pendientes"
        ? error.message
        : "Error al actualizar la entrega";
    console.error("updateCashDelivery:", error);
    return { success: false, error: message };
  }
}

export async function markCashDeliveryDelivered(
  id: number
): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.cashDelivery.findUnique({ where: { deliveryId: id } });
      if (!prev) throw new Error("Entrega no encontrada");
      if (prev.status !== "pending") {
        throw new Error("Solo se pueden confirmar entregas pendientes");
      }
      await tx.cashDelivery.update({
        where: { deliveryId: id },
        data: {
          status: "delivered",
          deliveredAt: new Date(),
          confirmedById: userId,
        },
      });
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
    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Solo se pueden confirmar entregas pendientes"
        ? error.message
        : "Error al marcar como entregada";
    console.error("markCashDeliveryDelivered:", error);
    return { success: false, error: message };
  }
}

export async function cancelCashDelivery(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.cashDelivery.findUnique({ where: { deliveryId: id } });
      if (!prev) throw new Error("Entrega no encontrada");
      if (prev.status !== "pending") {
        throw new Error("Solo se pueden cancelar entregas pendientes");
      }
      await tx.cashDelivery.update({
        where: { deliveryId: id },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "CashDelivery",
        entityId: id,
        module: "envios",
        userId,
        oldValues: { status: prev.status },
        newValues: { status: "cancelled" },
      });
    });
    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Solo se pueden cancelar entregas pendientes"
        ? error.message
        : "Error al cancelar la entrega";
    console.error("cancelCashDelivery:", error);
    return { success: false, error: message };
  }
}

export async function deleteCashDelivery(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.cashDelivery.findUnique({ where: { deliveryId: id } });
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
    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error && error.message === "No se pueden eliminar entregas ya confirmadas"
        ? error.message
        : "Error al eliminar la entrega";
    console.error("deleteCashDelivery:", error);
    return { success: false, error: message };
  }
}
