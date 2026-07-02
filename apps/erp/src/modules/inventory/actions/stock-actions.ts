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
import { toBaseQuantity, formatEquivalence } from "@/modules/inventory/lib/units";
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

interface ResolvedPresentation {
  presentationId: number | null;
  factor: number;
  baseQuantity: number;
  equivalenceNote: string;
}

/**
 * Resuelve y valida server-side la presentaci\u00f3n (si viene una en el input):
 * pertenencia al producto, activa, y factor SIEMPRE tomado de la BD (nunca
 * del caller). Devuelve la cantidad ya convertida a unidad base y una nota de
 * equivalencia lista para anexar al movimiento cuando factor !== 1.
 */
async function resolvePresentation(
  tx: PrismaTx,
  params: { productId: number; presentationId?: number; quantity: number; productUnit: string }
): Promise<ResolvedPresentation> {
  const { productId, presentationId, quantity, productUnit } = params;

  if (presentationId == null) {
    return { presentationId: null, factor: 1, baseQuantity: quantity, equivalenceNote: "" };
  }

  const presentation = await tx.productPresentation.findUnique({
    where: { presentationId },
  });
  if (!presentation || presentation.productId !== productId) {
    throw new Error(`La presentaci\u00f3n seleccionada no corresponde al producto ${productId}`);
  }
  if (!presentation.isActive) {
    throw new Error(`La presentaci\u00f3n "${presentation.name}" est\u00e1 inactiva`);
  }

  const factor = Number(presentation.factor);
  const baseQuantity = toBaseQuantity(quantity, factor);
  const equivalenceNote =
    factor !== 1 ? ` \u2014 ${formatEquivalence(quantity, factor, presentation.name, productUnit)}` : "";

  return { presentationId: presentation.presentationId, factor, baseQuantity, equivalenceNote };
}

// -----------------------------------------------------------------------------
// ENTRY / EXIT / ADJUSTMENT (single warehouse)
// -----------------------------------------------------------------------------
export async function createStockMovement(data: {
  productId: number;
  warehouseId: number;
  quantity: number;               // Siempre positivo, en la unidad de `presentationId` (o base si se omite). El signo lo determina movementType.
  presentationId?: number;
  movementType: "entry" | "exit" | "adjustment";
  adjustmentSign?: "positive" | "negative"; // requerido si movementType === "adjustment"
  /** Costo por unidad. Si hay presentationId, se interpreta por unidad de PRESENTACI\u00d3N (se divide por el factor para obtener costo por unidad base). */
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
      const product = await tx.product.findUnique({
        where: { productId: data.productId },
        select: { allowNegative: true, unit: true },
      });
      if (!product) throw new Error(`Producto ${data.productId} no existe`);
      const allowNegative = product.allowNegative ?? false;

      const { presentationId, factor, baseQuantity, equivalenceNote } = await resolvePresentation(tx, {
        productId: data.productId,
        presentationId: data.presentationId,
        quantity: data.quantity,
        productUnit: product.unit,
      });

      // Costo por unidad base: si el costo del input viene por presentaci\u00f3n,
      // se divide por el factor (ej. $550 la caja de 24 = $22.9166... la lata).
      const unitCostPerBase = data.unitCost != null ? data.unitCost / factor : undefined;

      // Calcular delta firmado sobre StockLevel (en unidad base)
      let delta = 0;
      if (data.movementType === "entry") {
        delta = baseQuantity;
      } else if (data.movementType === "exit") {
        delta = -baseQuantity;
      } else if (data.movementType === "adjustment") {
        if (!data.adjustmentSign) {
          throw new Error("Debe indicar si el ajuste es positivo o negativo");
        }
        delta = data.adjustmentSign === "positive" ? baseQuantity : -baseQuantity;
      } else {
        throw new Error(`Tipo de movimiento invalido: ${data.movementType}`);
      }

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

      let actualUnitCost = unitCostPerBase ?? null;

      // Valuaci\u00f3n: entrada
      if (data.movementType === "entry") {
        await applyInventoryEntry(tx, {
          productId: data.productId,
          warehouseId: data.warehouseId,
          qty: baseQuantity,
          unitCost: unitCostPerBase ?? 0,
          sourceType: "adjustment_entry",
        });
      } else if (
        data.movementType === "exit" ||
        (data.movementType === "adjustment" && delta < 0)
      ) {
        const exit = await applyInventoryExit(tx, {
          productId: data.productId,
          warehouseId: data.warehouseId,
          qty: baseQuantity,
        });
        if (actualUnitCost == null) actualUnitCost = exit.avgCostUsed;
      } else if (data.movementType === "adjustment" && delta > 0) {
        // Ajuste positivo sin costo se registra como entrada a costo 0
        await applyInventoryEntry(tx, {
          productId: data.productId,
          warehouseId: data.warehouseId,
          qty: baseQuantity,
          unitCost: unitCostPerBase ?? 0,
          sourceType: "adjustment_entry",
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId: data.productId,
          warehouseId: data.warehouseId,
          quantity: baseQuantity,
          movementType: data.movementType,
          unitCost: actualUnitCost,
          referenceTripId: data.referenceTripId ?? null,
          referenceDoc: data.referenceDoc || null,
          notes: data.notes ? `${data.notes}${equivalenceNote}` : equivalenceNote || null,
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
          presentationId,
          unitFactor: factor,
          baseQuantity,
          movementType: data.movementType,
          delta,
          unitCost: unitCostPerBase ?? null,
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
  presentationId?: number;
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
        select: { allowNegative: true, unit: true },
      });
      if (!product) throw new Error(`Producto ${data.productId} no existe`);
      const allowNegative = product.allowNegative ?? false;

      const { presentationId, factor, baseQuantity, equivalenceNote } = await resolvePresentation(tx, {
        productId: data.productId,
        presentationId: data.presentationId,
        quantity: data.quantity,
        productUnit: product.unit,
      });

      // Descontar del almacen origen de forma atomica (salvo producto con
      // allowNegative). Si no alcanza, lanza el error de stock insuficiente
      // antes de tocar la valuacion, igual que el comportamiento anterior.
      // Siempre en unidad base.
      await applyStockLevelDelta(tx, {
        productId: data.productId,
        warehouseId: data.warehouseIdFrom,
        delta: -baseQuantity,
        allowNegative,
      });

      const noteBase = data.notes
        ? `${data.notes} | Transferencia${equivalenceNote}`
        : `Transferencia entre almacenes${equivalenceNote}`;

      // Valuaci\u00f3n: mover costo entre almacenes (en unidad base)
      const { avgCostUsed } = await applyInventoryTransfer(tx, {
        productId: data.productId,
        warehouseIdFrom: data.warehouseIdFrom,
        warehouseIdTo: data.warehouseIdTo,
        qty: baseQuantity,
      });

      // Salida del almacen origen
      const outMovement = await tx.stockMovement.create({
        data: {
          productId: data.productId,
          warehouseId: data.warehouseIdFrom,
          quantity: baseQuantity,
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
          quantity: baseQuantity,
          movementType: "transfer",
          unitCost: avgCostUsed,
          referenceDoc: data.referenceDoc || null,
          notes: `${noteBase} <- almacen ${data.warehouseIdFrom}`,
          createdBy: userId,
        },
      });

      await upsertStockLevel(tx, data.productId, data.warehouseIdTo, baseQuantity);

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
          presentationId,
          unitFactor: factor,
          baseQuantity,
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
