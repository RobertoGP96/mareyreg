"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";

export async function createProduct(data: {
  name: string;
  sku?: string;
  barcode?: string;
  category?: string;
  unit: string;
  minStock?: number;
  maxStock?: number;
  costPrice?: number;
  salePrice?: number;
  secondaryPrice?: number;
  valuationMethod?: "fifo" | "average";
  tracksLots?: boolean;
  allowNegative?: boolean;
  imageUrl?: string;
  supplierId?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  isService?: boolean;
  brand?: string;
  supplier?: string;
  supplierRef?: string;
  description?: string;
  notes?: string;
}): Promise<ActionResult<{ productId: number }>> {
  try {
    if (data.sku) {
      const existing = await db.product.findUnique({ where: { sku: data.sku } });
      if (existing) {
        return { success: false, error: `Ya existe un producto con SKU ${data.sku}` };
      }
    }

    if (data.barcode) {
      const existing = await db.product.findUnique({ where: { barcode: data.barcode } });
      if (existing) {
        return { success: false, error: `Ya existe un producto con codigo de barras ${data.barcode}` };
      }
    }

    const userId = await getCurrentUserId();
    const product = await db.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          name: data.name,
          sku: data.sku || null,
          barcode: data.barcode || null,
          category: data.category || null,
          unit: data.unit,
          minStock: data.minStock ?? 0,
          maxStock: data.maxStock ?? null,
          costPrice: data.costPrice ?? null,
          salePrice: data.salePrice ?? null,
          secondaryPrice: data.secondaryPrice ?? null,
          valuationMethod: data.valuationMethod ?? "average",
          tracksLots: data.tracksLots ?? false,
          allowNegative: data.allowNegative ?? false,
          imageUrl: data.imageUrl || null,
          supplierId: data.supplierId ?? null,
          reorderPoint: data.reorderPoint ?? null,
          reorderQuantity: data.reorderQuantity ?? null,
          isService: data.isService ?? false,
          brand: data.brand || null,
          supplier: data.supplier || null,
          supplierRef: data.supplierRef || null,
          description: data.description || null,
          notes: data.notes || null,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "Product",
        entityId: p.productId,
        module: "inventory",
        userId,
        newValues: data,
      });
      return p;
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
  data: {
    name?: string;
    sku?: string;
    barcode?: string;
    category?: string;
    unit?: string;
    minStock?: number;
    maxStock?: number;
    costPrice?: number;
    salePrice?: number;
    secondaryPrice?: number;
    valuationMethod?: "fifo" | "average";
    tracksLots?: boolean;
    allowNegative?: boolean;
    imageUrl?: string;
    supplierId?: number | null;
    reorderPoint?: number;
    reorderQuantity?: number;
    isService?: boolean;
    brand?: string;
    supplier?: string;
    supplierRef?: string;
    description?: string;
    notes?: string;
    isActive?: boolean;
  }
): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.product.findUnique({ where: { productId: id } });
      await tx.product.update({
        where: { productId: id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.sku !== undefined && { sku: data.sku || null }),
          ...(data.barcode !== undefined && { barcode: data.barcode || null }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.unit !== undefined && { unit: data.unit }),
          ...(data.minStock !== undefined && { minStock: data.minStock }),
          ...(data.maxStock !== undefined && { maxStock: data.maxStock ?? null }),
          ...(data.costPrice !== undefined && { costPrice: data.costPrice ?? null }),
          ...(data.salePrice !== undefined && { salePrice: data.salePrice ?? null }),
          ...(data.secondaryPrice !== undefined && { secondaryPrice: data.secondaryPrice ?? null }),
          ...(data.valuationMethod !== undefined && { valuationMethod: data.valuationMethod }),
          ...(data.tracksLots !== undefined && { tracksLots: data.tracksLots }),
          ...(data.allowNegative !== undefined && { allowNegative: data.allowNegative }),
          ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
          ...(data.supplierId !== undefined && { supplierId: data.supplierId ?? null }),
          ...(data.reorderPoint !== undefined && { reorderPoint: data.reorderPoint ?? null }),
          ...(data.reorderQuantity !== undefined && { reorderQuantity: data.reorderQuantity ?? null }),
          ...(data.isService !== undefined && { isService: data.isService }),
          ...(data.brand !== undefined && { brand: data.brand || null }),
          ...(data.supplier !== undefined && { supplier: data.supplier || null }),
          ...(data.supplierRef !== undefined && { supplierRef: data.supplierRef || null }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Product",
        entityId: id,
        module: "inventory",
        userId,
        oldValues: prev,
        newValues: data,
      });
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
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.product.findUnique({ where: { productId: id } });
      await tx.product.delete({ where: { productId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "Product",
        entityId: id,
        module: "inventory",
        userId,
        oldValues: prev,
      });
    });
    revalidatePath("/products");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting product:", error);
    return { success: false, error: "Error al eliminar el producto. Verifique que no tiene movimientos de stock." };
  }
}
