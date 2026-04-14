"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

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

    const category = await db.pacaCategory.create({
      data: {
        name: data.name,
        description: data.description || null,
        classificationId,
      },
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

    await db.pacaCategory.update({
      where: { categoryId: id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.classificationId !== undefined && { classificationId: data.classificationId }),
      },
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
    await db.pacaCategory.delete({ where: { categoryId: id } });
    revalidatePath("/pacas");
    revalidatePath("/pacas/categorias");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting paca category:", error);
    return { success: false, error: "Error al eliminar la categoria. Asegurese de que no tiene pacas asociadas." };
  }
}
