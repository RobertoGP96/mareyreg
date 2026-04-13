"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function createStockMovement(data: {
  productId: number;
  warehouseId: number;
  quantity: number;
  movementType: string;
  unitCost?: number;
  referenceTripId?: number;
  referenceDoc?: string;
  notes?: string;
}): Promise<ActionResult<{ movementId: number }>> {
  try {
    const result = await db.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          productId: data.productId,
          warehouseId: data.warehouseId,
          quantity: data.quantity,
          movementType: data.movementType as "entry" | "exit" | "transfer" | "adjustment",
          unitCost: data.unitCost ?? null,
          referenceTripId: data.referenceTripId || null,
          referenceDoc: data.referenceDoc || null,
          notes: data.notes || null,
        },
      });

      let quantityChange = data.quantity;
      if (data.movementType === "exit") {
        quantityChange = -data.quantity;
      }

      await tx.stockLevel.upsert({
        where: {
          productId_warehouseId: {
            productId: data.productId,
            warehouseId: data.warehouseId,
          },
        },
        create: {
          productId: data.productId,
          warehouseId: data.warehouseId,
          currentQuantity: Math.max(0, quantityChange),
        },
        update: {
          currentQuantity: {
            increment: quantityChange,
          },
          lastUpdated: new Date(),
        },
      });

      // Actualizar costo del producto en entradas con costo unitario
      if (data.movementType === "entry" && data.unitCost) {
        await tx.product.update({
          where: { productId: data.productId },
          data: { costPrice: data.unitCost },
        });
      }

      return movement;
    });

    revalidatePath("/stock");
    return { success: true, data: { movementId: result.movementId } };
  } catch (error) {
    console.error("Error creating stock movement:", error);
    return { success: false, error: "Error al registrar el movimiento de stock" };
  }
}
