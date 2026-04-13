"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function createProduct(data: {
  name: string;
  sku?: string;
  category?: string;
  unit: string;
  minStock?: number;
  description?: string;
}): Promise<ActionResult<{ productId: number }>> {
  try {
    if (data.sku) {
      const existing = await db.product.findUnique({ where: { sku: data.sku } });
      if (existing) {
        return { success: false, error: `Ya existe un producto con SKU ${data.sku}` };
      }
    }

    const product = await db.product.create({
      data: {
        name: data.name,
        sku: data.sku || null,
        category: data.category || null,
        unit: data.unit,
        minStock: data.minStock ?? 0,
        description: data.description || null,
      },
    });

    revalidatePath("/products");
    return { success: true, data: { productId: product.productId } };
  } catch (error) {
    console.error("Error creating product:", error);
    return { success: false, error: "Error al crear el producto" };
  }
}

export async function updateProduct(
  id: number,
  data: { name?: string; sku?: string; category?: string; unit?: string; minStock?: number; description?: string }
): Promise<ActionResult<void>> {
  try {
    await db.product.update({
      where: { productId: id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.sku !== undefined && { sku: data.sku || null }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.minStock !== undefined && { minStock: data.minStock }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });

    revalidatePath("/products");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating product:", error);
    return { success: false, error: "Error al actualizar el producto" };
  }
}

export async function deleteProduct(id: number): Promise<ActionResult<void>> {
  try {
    await db.product.delete({ where: { productId: id } });
    revalidatePath("/products");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting product:", error);
    return { success: false, error: "Error al eliminar el producto. Verifique que no tiene movimientos de stock." };
  }
}
