"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId, requireCurrentUserId } from "@/lib/audit";
import { recipientSchema, type RecipientInput } from "../lib/schemas";

const revalidateAll = () => {
  revalidatePath("/envios/destinatarios");
  revalidatePath("/envios/entregas");
};

function normalizeMapUrl(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function createRecipient(
  input: RecipientInput
): Promise<ActionResult<{ recipientId: number }>> {
  try {
    const parsed = recipientSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;
    const userId = await requireCurrentUserId();

    const created = await db.$transaction(async (tx) => {
      const r = await tx.recipient.create({
        data: {
          userId,
          fullName: data.fullName,
          phone: data.phone?.trim() || null,
          address: data.address?.trim() || null,
          mapUrl: normalizeMapUrl(data.mapUrl ?? null),
          active: data.active ?? true,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "Recipient",
        entityId: r.recipientId,
        module: "envios",
        userId,
        newValues: data,
      });
      return r;
    });

    revalidateAll();
    return { success: true, data: { recipientId: created.recipientId } };
  } catch (error) {
    console.error("createRecipient:", error);
    return { success: false, error: "Error al crear el destinatario" };
  }
}

export async function updateRecipient(
  id: number,
  input: Partial<RecipientInput>
): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.recipient.findUnique({ where: { recipientId: id } });
      if (!prev) throw new Error("Destinatario no encontrado");
      await tx.recipient.update({
        where: { recipientId: id },
        data: {
          ...(input.fullName !== undefined && { fullName: input.fullName.trim() }),
          ...(input.phone !== undefined && { phone: input.phone?.trim() || null }),
          ...(input.address !== undefined && { address: input.address?.trim() || null }),
          ...(input.mapUrl !== undefined && { mapUrl: normalizeMapUrl(input.mapUrl ?? null) }),
          ...(input.active !== undefined && { active: input.active }),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Recipient",
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
    console.error("updateRecipient:", error);
    return { success: false, error: "Error al actualizar el destinatario" };
  }
}

export async function toggleRecipientActive(
  id: number
): Promise<ActionResult<{ active: boolean }>> {
  try {
    const userId = await getCurrentUserId();
    const next = await db.$transaction(async (tx) => {
      const prev = await tx.recipient.findUnique({ where: { recipientId: id } });
      if (!prev) throw new Error("Destinatario no encontrado");
      const updated = await tx.recipient.update({
        where: { recipientId: id },
        data: { active: !prev.active },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Recipient",
        entityId: id,
        module: "envios",
        userId,
        oldValues: { active: prev.active },
        newValues: { active: updated.active },
      });
      return updated.active;
    });
    revalidateAll();
    return { success: true, data: { active: next } };
  } catch (error) {
    console.error("toggleRecipientActive:", error);
    return { success: false, error: "Error al cambiar el estado" };
  }
}

export async function deleteRecipient(id: number): Promise<ActionResult<void>> {
  try {
    const linked = await db.cashDelivery.count({ where: { recipientId: id } });
    if (linked > 0) {
      return {
        success: false,
        error: `No se puede eliminar: ${linked} entrega(s) registradas. Desactívalo en su lugar.`,
      };
    }
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.recipient.findUnique({ where: { recipientId: id } });
      await tx.recipient.delete({ where: { recipientId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "Recipient",
        entityId: id,
        module: "envios",
        userId,
        oldValues: prev,
      });
    });
    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    console.error("deleteRecipient:", error);
    return { success: false, error: "Error al eliminar el destinatario" };
  }
}
