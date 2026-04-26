"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";

export interface PacaClassificationInput {
  name: string;
  description?: string | null;
  sortOrder?: number;
}

const revalidateAll = () => {
  revalidatePath("/pacas");
  revalidatePath("/pacas/clasificaciones");
  revalidatePath("/pacas/categorias");
  revalidatePath("/pacas/disponibilidad");
};

export async function createPacaClassification(
  data: PacaClassificationInput
): Promise<ActionResult<{ classificationId: number }>> {
  try {
    if (!data.name?.trim()) {
      return { success: false, error: "El nombre es requerido" };
    }
    const existing = await db.pacaClassification.findUnique({
      where: { name: data.name.trim() },
    });
    if (existing) {
      return { success: false, error: `Ya existe una clasificación llamada "${data.name}"` };
    }

    const userId = await getCurrentUserId();
    const created = await db.$transaction(async (tx) => {
      const c = await tx.pacaClassification.create({
        data: {
          name: data.name.trim(),
          description: data.description?.trim() || null,
          sortOrder: data.sortOrder ?? 0,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "PacaClassification",
        entityId: c.classificationId,
        module: "pacas",
        userId,
        newValues: data,
      });
      return c;
    });

    revalidateAll();
    return { success: true, data: { classificationId: created.classificationId } };
  } catch (error) {
    console.error("Error creating paca classification:", error);
    return { success: false, error: "Error al crear la clasificación" };
  }
}

export async function updatePacaClassification(
  id: number,
  data: Partial<PacaClassificationInput>
): Promise<ActionResult<void>> {
  try {
    if (data.name !== undefined && !data.name.trim()) {
      return { success: false, error: "El nombre es requerido" };
    }
    if (data.name) {
      const dup = await db.pacaClassification.findFirst({
        where: { name: data.name.trim(), NOT: { classificationId: id } },
      });
      if (dup) return { success: false, error: `Ya existe "${data.name}"` };
    }

    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.pacaClassification.findUnique({
        where: { classificationId: id },
      });
      await tx.pacaClassification.update({
        where: { classificationId: id },
        data: {
          ...(data.name !== undefined && { name: data.name.trim() }),
          ...(data.description !== undefined && {
            description: data.description?.trim() || null,
          }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "PacaClassification",
        entityId: id,
        module: "pacas",
        userId,
        oldValues: prev,
        newValues: data,
      });
    });

    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating paca classification:", error);
    return { success: false, error: "Error al actualizar la clasificación" };
  }
}

export async function deletePacaClassification(
  id: number
): Promise<ActionResult<void>> {
  try {
    const linked = await db.pacaCategory.count({ where: { classificationId: id } });
    if (linked > 0) {
      return {
        success: false,
        error: `No se puede eliminar: ${linked} categoría(s) la usan. Reasigna o elimina primero.`,
      };
    }
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.pacaClassification.findUnique({
        where: { classificationId: id },
      });
      await tx.pacaClassification.delete({ where: { classificationId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "PacaClassification",
        entityId: id,
        module: "pacas",
        userId,
        oldValues: prev,
      });
    });
    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting paca classification:", error);
    return { success: false, error: "Error al eliminar la clasificación" };
  }
}
