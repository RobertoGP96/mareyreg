"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

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
    if (data.quantity < 1) {
      return { success: false, error: "La cantidad debe ser al menos 1" };
    }

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
        },
        update: {
          available: { increment: data.quantity },
        },
      });

      return entry;
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/disponibilidad");
    return { success: true, data: { entryId: result.entryId } };
  } catch (error) {
    console.error("Error creating paca entry:", error);
    return { success: false, error: "Error al registrar la entrada" };
  }
}

export async function deletePacaEntry(id: number): Promise<ActionResult<void>> {
  try {
    const entry = await db.pacaEntry.findUnique({ where: { entryId: id } });
    if (!entry) {
      return { success: false, error: "Entrada no encontrada" };
    }

    await db.$transaction(async (tx) => {
      await tx.pacaEntry.delete({ where: { entryId: id } });
      await tx.pacaInventory.update({
        where: { categoryId: entry.categoryId },
        data: { available: { decrement: entry.quantity } },
      });
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/disponibilidad");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting paca entry:", error);
    return { success: false, error: "Error al eliminar la entrada" };
  }
}
