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
    const existing = await db.pacaCategory.findUnique({ where: { name: data.name } });
    if (existing) {
      return { success: false, error: `Ya existe la categoria "${data.name}"` };
    }

    const category = await db.pacaCategory.create({
      data: {
        name: data.name,
        description: data.description || null,
        classificationId: data.classificationId || null,
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
