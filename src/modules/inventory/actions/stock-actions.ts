"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";
import {
  applyInventoryEntry,
  applyInventoryExit,
  applyInventoryTransfer,
} from "@/lib/valuation";
import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;

async function getStockQty(
  tx: PrismaTx,
  productId: number,
  warehouseId: number
): Promise<number> {
  const level = await tx.stockLevel.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  return level ? Number(level.currentQuantity) : 0;
}

async function upsertStockLevel(
  tx: PrismaTx,
  productId: number,
  warehouseId: number,
  delta: number
): Promise<void> {
  await tx.stockLevel.upsert({
    where: { productId_warehouseId: { productId, warehouseId } },
    create: {
      productId,
      warehouseId,
      currentQuantity: delta,
    },
    update: {
      currentQuantity: { increment: delta },
      lastUpdated: new Date(),
    },
  });
}

// -----------------------------------------------------------------------------
// ENTRY / EXIT / ADJUSTMENT (single warehouse)
// -----------------------------------------------------------------------------
export async function createStockMovement(data: {
  productId: number;
  warehouseId: number;
  quantity: number;               // Siempre positivo. El signo lo determina movementType.
  movementType: "entry" | "exit" | "adjustment";
  adjustmentSign?: "positive" | "negative"; // requerido si movementType === "adjustment"
  unitCost?: number;
  referenceTripId?: number;
  referenceDoc?: string;
  notes?: string;
}): Promise<ActionResult<{ movementId: number }>> {
  try {
    if (data.quantity <= 0) {
      return { success: false, error: "La cantidad debe ser mayor a 0" };
    }

    const userId = await getCurrentUserId();

    const result = await db.$transaction(async (tx) => {
      // Calcular delta firmado sobre StockLevel
      let delta = 0;
      if (data.movementType === "entry") {
        delta = data.quantity;
      } else if (data.movementType === "exit") {
        delta = -data.quantity;
      } else if (data.movementType === "adjustment") {
        if (!data.adjustmentSign) {
          throw new Error("Debe indicar si el ajuste es positivo o negativo");
        }
        delta = data.adjustmentSign === "positive" ? data.quantity : -data.quantity;
      } else {
        throw new Error(`Tipo de movimiento invalido: ${data.movementType}`);
      }

      // Validar que no quede negativo (respetando allowNegative por producto)
      if (delta < 0) {
        const product = await tx.product.findUnique({
          where: { productId: data.productId },
          select: { allowNegative: true },
        });
        if (!product?.allowNegative) {
          const current = await getStockQty(tx, data.productId, data.warehouseId);
          if (current + delta < 0) {
            throw new Error(
              `Stock insuficiente. Disponible: ${current}, solicitado: ${Math.abs(delta)}`
            );
          }
        }
      }

      let actualUnitCost = data.unitCost ?? null;

      // Valuaci\u00f3n: entrada
      if (data.movementType === "entry") {
        await applyInventoryEntry(tx, {
          productId: data.productId,
          warehouseId: data.warehouseId,
          qty: data.quantity,
          unitCost: data.unitCost ?? 0,
          sourceType: "adjustment_entry",
        });
      } else if (
        data.movementType === "exit" ||
        (data.movementType === "adjustment" && delta < 0)
      ) {
        const exit = await applyInventoryExit(tx, {
          productId: data.productId,
          warehouseId: data.warehouseId,
          qty: data.quantity,
        });
        if (actualUnitCost == null) actualUnitCost = exit.avgCostUsed;
      } else if (data.movementType === "adjustment" && delta > 0) {
        // Ajuste positivo sin costo se registra como entrada a costo 0
        await applyInventoryEntry(tx, {
          productId: data.productId,
          warehouseId: data.warehouseId,
          qty: data.quantity,
          unitCost: data.unitCost ?? 0,
          sourceType: "adjustment_entry",
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId: data.productId,
          warehouseId: data.warehouseId,
          quantity: data.quantity,
          movementType: data.movementType,
          unitCost: actualUnitCost,
          referenceTripId: data.referenceTripId ?? null,
          referenceDoc: data.referenceDoc || null,
          notes: data.notes || null,
          createdBy: userId,
        },
      });

      await upsertStockLevel(tx, data.productId, data.warehouseId, delta);

      await createAuditLog(tx, {
        action: "create",
        entityType: "StockMovement",
        entityId: movement.movementId,
        module: "inventory",
        userId,
        newValues: {
          productId: data.productId,
          warehouseId: data.warehouseId,
          quantity: data.quantity,
          movementType: data.movementType,
          delta,
          unitCost: data.unitCost ?? null,
        },
      });

      return movement;
    });

    revalidatePath("/stock");
    return { success: true, data: { movementId: result.movementId } };
  } catch (error) {
    console.error("Error creating stock movement:", error);
    const message =
      error instanceof Error ? error.message : "Error al registrar el movimiento de stock";
    return { success: false, error: message };
  }
}

// -----------------------------------------------------------------------------
// TRANSFER between warehouses (2 StockMovement rows + 2 StockLevel updates)
// -----------------------------------------------------------------------------
export async function createStockTransfer(data: {
  productId: number;
  warehouseIdFrom: number;
  warehouseIdTo: number;
  quantity: number;
  referenceDoc?: string;
  notes?: string;
}): Promise<ActionResult<{ outMovementId: number; inMovementId: number }>> {
  try {
    if (data.quantity <= 0) {
      return { success: false, error: "La cantidad debe ser mayor a 0" };
    }
    if (data.warehouseIdFrom === data.warehouseIdTo) {
      return { success: false, error: "El almacen origen y destino deben ser diferentes" };
    }

    const userId = await getCurrentUserId();

    const result = await db.$transaction(async (tx) => {
      // Validar stock en origen (salvo producto con allowNegative)
      const product = await tx.product.findUnique({
        where: { productId: data.productId },
        select: { allowNegative: true },
      });
      if (!product?.allowNegative) {
        const current = await getStockQty(tx, data.productId, data.warehouseIdFrom);
        if (current < data.quantity) {
          throw new Error(
            `Stock insuficiente en almacen origen. Disponible: ${current}, solicitado: ${data.quantity}`
          );
        }
      }

      const noteBase = data.notes
        ? `${data.notes} | Transferencia`
        : "Transferencia entre almacenes";

      // Valuaci\u00f3n: mover costo entre almacenes
      const { avgCostUsed } = await applyInventoryTransfer(tx, {
        productId: data.productId,
        warehouseIdFrom: data.warehouseIdFrom,
        warehouseIdTo: data.warehouseIdTo,
        qty: data.quantity,
      });

      // Salida del almacen origen
      const outMovement = await tx.stockMovement.create({
        data: {
          productId: data.productId,
          warehouseId: data.warehouseIdFrom,
          quantity: data.quantity,
          movementType: "transfer",
          unitCost: avgCostUsed,
          referenceDoc: data.referenceDoc || null,
          notes: `${noteBase} -> almacen ${data.warehouseIdTo}`,
          createdBy: userId,
        },
      });

      // Entrada en el almacen destino
      const inMovement = await tx.stockMovement.create({
        data: {
          productId: data.productId,
          warehouseId: data.warehouseIdTo,
          quantity: data.quantity,
          movementType: "transfer",
          unitCost: avgCostUsed,
          referenceDoc: data.referenceDoc || null,
          notes: `${noteBase} <- almacen ${data.warehouseIdFrom}`,
          createdBy: userId,
        },
      });

      await upsertStockLevel(tx, data.productId, data.warehouseIdFrom, -data.quantity);
      await upsertStockLevel(tx, data.productId, data.warehouseIdTo, data.quantity);

      await createAuditLog(tx, {
        action: "create",
        entityType: "StockTransfer",
        entityId: outMovement.movementId,
        module: "inventory",
        userId,
        newValues: {
          productId: data.productId,
          warehouseIdFrom: data.warehouseIdFrom,
          warehouseIdTo: data.warehouseIdTo,
          quantity: data.quantity,
          outMovementId: outMovement.movementId,
          inMovementId: inMovement.movementId,
        },
      });

      return { outMovement, inMovement };
    });

    revalidatePath("/stock");
    return {
      success: true,
      data: {
        outMovementId: result.outMovement.movementId,
        inMovementId: result.inMovement.movementId,
      },
    };
  } catch (error) {
    console.error("Error creating stock transfer:", error);
    const message =
      error instanceof Error ? error.message : "Error al registrar la transferencia";
    return { success: false, error: message };
  }
}
