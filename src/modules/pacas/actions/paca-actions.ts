"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { recordShadowMovement } from "@/modules/pacas/lib/shadow-product";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

export async function createPacaEntry(data: {
  categoryId: number;
  quantity: number;
  purchasePrice?: number;
  supplier?: string;
  origin?: string;
  arrivalDate?: string;
  notes?: string;
}): Promise<ActionResult<{ entryId: number }>> {
  try {
    if (!Number.isInteger(data.quantity) || data.quantity < 1) {
      return { success: false, error: "La cantidad debe ser un entero mayor o igual a 1" };
    }
    if (data.purchasePrice !== undefined && data.purchasePrice < 0) {
      return { success: false, error: "El precio de compra no puede ser negativo" };
    }

    const entryCost = (data.purchasePrice ?? 0) * data.quantity;
    const userId = await requireCurrentUserId();

    const result = await db.$transaction(async (tx) => {
      const entry = await tx.pacaEntry.create({
        data: {
          categoryId: data.categoryId,
          quantity: data.quantity,
          purchasePrice: data.purchasePrice ?? null,
          supplier: data.supplier || null,
          origin: data.origin || null,
          arrivalDate: data.arrivalDate || null,
          notes: data.notes || null,
        },
      });

      await tx.pacaInventory.upsert({
        where: { categoryId: data.categoryId },
        create: {
          categoryId: data.categoryId,
          available: data.quantity,
          reserved: 0,
          sold: 0,
          totalCost: entryCost,
        },
        update: {
          available: { increment: data.quantity },
          totalCost: { increment: entryCost },
        },
      });

      await recordShadowMovement(tx, {
        categoryId: data.categoryId,
        quantity: data.quantity,
        unitCost: data.purchasePrice ?? 0,
        movementType: "entry",
        reference: `paca:entrada #${entry.entryId}`,
        userId,
      });

      await createAuditLog(tx, {
        action: "create",
        entityType: "PacaEntry",
        entityId: entry.entryId,
        module: "pacas",
        userId,
        newValues: data,
      });

      return entry;
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/disponibilidad");
    return { success: true, data: { entryId: result.entryId } };
  } catch (error) {
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para registrar una entrada" };
    }
    console.error("Error creating paca entry:", error);
    return { success: false, error: "Error al registrar la entrada" };
  }
}

export async function deletePacaEntries(
  ids: number[]
): Promise<ActionResult<{ deleted: number }>> {
  try {
    if (!ids.length) return { success: true, data: { deleted: 0 } };
    let deleted = 0;
    for (const id of ids) {
      const r = await deletePacaEntry(id);
      if (r.success) deleted++;
    }
    return { success: true, data: { deleted } };
  } catch (error) {
    console.error("Error in bulk delete entries:", error);
    return { success: false, error: "Error al eliminar entradas en lote" };
  }
}

export async function deletePacaEntry(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();

    await db.$transaction(async (tx) => {
      const entry = await tx.pacaEntry.findUnique({ where: { entryId: id } });
      if (!entry) {
        throw new Error("Entrada no encontrada");
      }

      const entryCost = Number(entry.purchasePrice ?? 0) * entry.quantity;

      const updated = await tx.pacaInventory.updateMany({
        where: { categoryId: entry.categoryId, available: { gte: entry.quantity } },
        data: {
          available: { decrement: entry.quantity },
          totalCost: { decrement: entryCost },
        },
      });
      if (updated.count !== 1) {
        throw new Error(
          "No hay suficientes pacas disponibles para revertir esta entrada"
        );
      }

      await tx.pacaEntry.delete({ where: { entryId: id } });

      await recordShadowMovement(tx, {
        categoryId: entry.categoryId,
        quantity: entry.quantity,
        unitCost: entry.quantity > 0 ? entryCost / entry.quantity : 0,
        movementType: "exit",
        reference: `paca:reverso-entrada #${entry.entryId}`,
        userId,
      });

      await createAuditLog(tx, {
        action: "delete",
        entityType: "PacaEntry",
        entityId: id,
        module: "pacas",
        userId,
        oldValues: entry,
      });
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/disponibilidad");
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para eliminar una entrada" };
    }
    if (
      error instanceof Error &&
      (error.message === "Entrada no encontrada" ||
        error.message === "No hay suficientes pacas disponibles para revertir esta entrada")
    ) {
      return { success: false, error: error.message };
    }
    console.error("Error deleting paca entry:", error);
    return { success: false, error: "Error al eliminar la entrada" };
  }
}
