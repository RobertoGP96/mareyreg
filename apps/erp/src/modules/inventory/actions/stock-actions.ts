"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import {
  applyInventoryEntry,
  applyInventoryExit,
  applyInventoryTransfer,
} from "@/lib/valuation";
import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;

const AUTH_ERROR_MESSAGE = "No autenticado";
const SESSION_ERROR_RESPONSE =
  "Tu sesión expiró o no iniciaste sesión. Vuelve a iniciar sesión e intenta de nuevo.";

// Whitelist de errores de negocio conocidos (mensajes ya en español, seguros
// de mostrar al usuario tal cual). Cualquier otro error se reemplaza por un
// mensaje generico para no filtrar detalles internos (stack, SQL, etc.).
function toUserMessage(error: unknown, genericMessage: string): string {
  if (error instanceof Error) {
    if (error.message === AUTH_ERROR_MESSAGE) return SESSION_ERROR_RESPONSE;
    if (
      error.message.startsWith("Stock insuficiente") ||
      error.message.startsWith("Stock FIFO insuficiente") ||
      error.message.includes("Debe indicar si el ajuste") ||
      error.message.startsWith("Tipo de movimiento invalido") ||
      error.message.includes("almacen origen y destino")
    ) {
      return error.message;
    }
  }
  return genericMessage;
}

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

/**
 * Igual que upsertStockLevel pero, cuando delta es negativo y allowNegative
 * es false, aplica el decremento con condicion atomica
 * (`currentQuantity >= |delta|`) via updateMany en vez de "findUnique + update"
 * para evitar condiciones de carrera entre transacciones concurrentes.
 * Si no existe la fila StockLevel aun, se trata como stock 0 (insuficiente).
 */
async function applyStockLevelDelta(
  tx: PrismaTx,
  params: { productId: number; warehouseId: number; delta: number; allowNegative: boolean }
): Promise<void> {
  const { productId, warehouseId, delta, allowNegative } = params;

  if (delta >= 0 || allowNegative) {
    await upsertStockLevel(tx, productId, warehouseId, delta);
    return;
  }

  const need = Math.abs(delta);
  const updated = await tx.stockLevel.updateMany({
    where: { productId, warehouseId, currentQuantity: { gte: need } },
    data: { currentQuantity: { decrement: need }, lastUpdated: new Date() },
  });

  if (updated.count === 0) {
    const current = await getStockQty(tx, productId, warehouseId);
    throw new Error(
      `Stock insuficiente. Disponible: ${current}, solicitado: ${need}`
    );
  }
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

    const userId = await requireCurrentUserId();

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

      const product = await tx.product.findUnique({
        where: { productId: data.productId },
        select: { allowNegative: true },
      });
      const allowNegative = product?.allowNegative ?? false;

      // Aplicar el delta a StockLevel primero, de forma atomica: si delta es
      // negativo y el producto no permite negativo, esto falla (lanzando el
      // error de stock insuficiente) antes de tocar la valuacion, igual que
      // el comportamiento anterior (findUnique + validar + luego mutar).
      await applyStockLevelDelta(tx, {
        productId: data.productId,
        warehouseId: data.warehouseId,
        delta,
        allowNegative,
      });

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
    const message = toUserMessage(error, "Error al registrar el movimiento de stock");
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

    const userId = await requireCurrentUserId();

    const result = await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { productId: data.productId },
        select: { allowNegative: true },
      });
      const allowNegative = product?.allowNegative ?? false;

      // Descontar del almacen origen de forma atomica (salvo producto con
      // allowNegative). Si no alcanza, lanza el error de stock insuficiente
      // antes de tocar la valuacion, igual que el comportamiento anterior.
      await applyStockLevelDelta(tx, {
        productId: data.productId,
        warehouseId: data.warehouseIdFrom,
        delta: -data.quantity,
        allowNegative,
      });

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
    const message = toUserMessage(error, "Error al registrar la transferencia");
    return { success: false, error: message };
  }
}
