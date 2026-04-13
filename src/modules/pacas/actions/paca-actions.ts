"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function createPaca(data: {
  code: string;
  weightKg: number;
  categoryId: number;
  origin?: string;
  supplier?: string;
  purchasePrice?: number;
  salePrice?: number;
  status?: string;
  arrivalDate?: string;
  notes?: string;
  warehouseId?: number;
}): Promise<ActionResult<{ pacaId: number }>> {
  try {
    const existing = await db.paca.findUnique({ where: { code: data.code } });
    if (existing) {
      return { success: false, error: `Ya existe una paca con el codigo ${data.code}` };
    }

    const paca = await db.paca.create({
      data: {
        code: data.code,
        weightKg: data.weightKg,
        categoryId: data.categoryId,
        origin: data.origin || null,
        supplier: data.supplier || null,
        purchasePrice: data.purchasePrice || null,
        salePrice: data.salePrice || null,
        status: (data.status as "available" | "sold" | "in_transit" | "reserved") || "available",
        arrivalDate: data.arrivalDate || null,
        notes: data.notes || null,
        warehouseId: data.warehouseId || null,
      },
    });

    revalidatePath("/pacas");
    return { success: true, data: { pacaId: paca.pacaId } };
  } catch (error) {
    console.error("Error creating paca:", error);
    return { success: false, error: "Error al crear la paca" };
  }
}

export async function updatePaca(
  id: number,
  data: {
    code?: string;
    weightKg?: number;
    categoryId?: number;
    origin?: string;
    supplier?: string;
    purchasePrice?: number;
    salePrice?: number;
    status?: string;
    arrivalDate?: string;
    notes?: string;
    warehouseId?: number | null;
  }
): Promise<ActionResult<void>> {
  try {
    await db.paca.update({
      where: { pacaId: id },
      data: {
        ...(data.code !== undefined && { code: data.code }),
        ...(data.weightKg !== undefined && { weightKg: data.weightKg }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.origin !== undefined && { origin: data.origin }),
        ...(data.supplier !== undefined && { supplier: data.supplier }),
        ...(data.purchasePrice !== undefined && { purchasePrice: data.purchasePrice }),
        ...(data.salePrice !== undefined && { salePrice: data.salePrice }),
        ...(data.status !== undefined && { status: data.status as "available" | "sold" | "in_transit" | "reserved" }),
        ...(data.arrivalDate !== undefined && { arrivalDate: data.arrivalDate }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.warehouseId !== undefined && { warehouseId: data.warehouseId }),
      },
    });

    revalidatePath("/pacas");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating paca:", error);
    return { success: false, error: "Error al actualizar la paca" };
  }
}

export async function deletePaca(id: number): Promise<ActionResult<void>> {
  try {
    await db.paca.delete({ where: { pacaId: id } });
    revalidatePath("/pacas");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting paca:", error);
    return { success: false, error: "Error al eliminar la paca" };
  }
}
