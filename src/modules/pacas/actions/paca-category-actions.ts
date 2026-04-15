"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";

export async function createPacaCategory(data: {
  name: string;
  description?: string;
  classificationId?: number;
}): Promise<ActionResult<{ categoryId: number }>> {
  try {
    const classificationId = data.classificationId || null;
    const existing = await db.pacaCategory.findFirst({
      where: { name: data.name, classificationId },
    });
    if (existing) {
      return {
        success: false,
        error: `Ya existe la categoria "${data.name}" en esta clasificacion`,
      };
    }

    const userId = await getCurrentUserId();
    const category = await db.$transaction(async (tx) => {
      const c = await tx.pacaCategory.create({
        data: {
          name: data.name,
          description: data.description || null,
          classificationId,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "PacaCategory",
        entityId: c.categoryId,
        module: "pacas",
        userId,
        newValues: data,
      });
      return c;
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/categorias");
    return { success: true, data: { categoryId: category.categoryId } };
  } catch (error) {
    console.error("Error creating paca category:", error);
    return { success: false, error: "Error al crear la categoria" };
  }
}

export async function updatePacaCategory(
  id: number,
  data: { name?: string; description?: string; classificationId?: number | null }
): Promise<ActionResult<void>> {
  try {
    if (data.name !== undefined || data.classificationId !== undefined) {
      const current = await db.pacaCategory.findUnique({
        where: { categoryId: id },
        select: { name: true, classificationId: true },
      });
      if (!current) {
        return { success: false, error: "Categoria no encontrada" };
      }
      const nextName = data.name ?? current.name;
      const nextClassificationId =
        data.classificationId !== undefined ? data.classificationId : current.classificationId;

      const duplicate = await db.pacaCategory.findFirst({
        where: {
          name: nextName,
          classificationId: nextClassificationId,
          NOT: { categoryId: id },
        },
      });
      if (duplicate) {
        return {
          success: false,
          error: `Ya existe la categoria "${nextName}" en esta clasificacion`,
        };
      }
    }

    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.pacaCategory.findUnique({ where: { categoryId: id } });
      await tx.pacaCategory.update({
        where: { categoryId: id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.classificationId !== undefined && { classificationId: data.classificationId }),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "PacaCategory",
        entityId: id,
        module: "pacas",
        userId,
        oldValues: prev,
        newValues: data,
      });
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/categorias");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating paca category:", error);
    return { success: false, error: "Error al actualizar la categoria" };
  }
}

export async function deletePacaCategory(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.pacaCategory.findUnique({ where: { categoryId: id } });
      await tx.pacaCategory.delete({ where: { categoryId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "PacaCategory",
        entityId: id,
        module: "pacas",
        userId,
        oldValues: prev,
      });
    });
    revalidatePath("/pacas");
    revalidatePath("/pacas/categorias");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting paca category:", error);
    return { success: false, error: "Error al eliminar la categoria. Asegurese de que no tiene pacas asociadas." };
  }
}
