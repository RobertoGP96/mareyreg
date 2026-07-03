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
import {
  toBaseQuantity,
  formatEquivalence,
  catchWeightBaseQuantity,
} from "@/modules/inventory/lib/units";
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
      error.message.includes("almacen origen y destino") ||
      error.message.includes("piezas") ||
      error.message.includes("peso capturado") ||
      error.message.includes("catch-weight") ||
      error.message.includes("peso variable")
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

async function getStockPieces(
  tx: PrismaTx,
  productId: number,
  warehouseId: number
): Promise<number> {
  const level = await tx.stockLevel.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  return level?.currentPieces ?? 0;
}

async function upsertStockLevel(
  tx: PrismaTx,
  productId: number,
  warehouseId: number,
  delta: number,
  piecesDelta = 0
): Promise<void> {
  await tx.stockLevel.upsert({
    where: { productId_warehouseId: { productId, warehouseId } },
    create: {
      productId,
      warehouseId,
      currentQuantity: delta,
      currentPieces: piecesDelta,
    },
    update: {
      currentQuantity: { increment: delta },
      ...(piecesDelta !== 0 ? { currentPieces: { increment: piecesDelta } } : {}),
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
 *
 * `piecesDelta` (catch-weight) se aplica en el MISMO updateMany que el delta
 * de kg: si piecesDelta < 0, la condicion atomica exige tambien
 * `currentPieces >= |piecesDelta|`, de forma que kg y piezas se validan y
 * mutan como una sola operacion — nunca se decrementa uno sin el otro.
 */
async function applyStockLevelDelta(
  tx: PrismaTx,
  params: {
    productId: number;
    warehouseId: number;
    delta: number;
    allowNegative: boolean;
    piecesDelta?: number;
  }
): Promise<void> {
  const { productId, warehouseId, delta, allowNegative, piecesDelta = 0 } = params;

  if ((delta >= 0 || allowNegative) && (piecesDelta >= 0 || allowNegative)) {
    await upsertStockLevel(tx, productId, warehouseId, delta, piecesDelta);
    return;
  }

  const needQty = delta < 0 ? Math.abs(delta) : 0;
  const needPieces = piecesDelta < 0 ? Math.abs(piecesDelta) : 0;

  const updated = await tx.stockLevel.updateMany({
    where: {
      productId,
      warehouseId,
      ...(needQty > 0 ? { currentQuantity: { gte: needQty } } : {}),
      ...(needPieces > 0 ? { currentPieces: { gte: needPieces } } : {}),
    },
    data: {
      currentQuantity: { increment: delta },
      ...(piecesDelta !== 0 ? { currentPieces: { increment: piecesDelta } } : {}),
      lastUpdated: new Date(),
    },
  });

  if (updated.count === 0) {
    const current = await getStockQty(tx, productId, warehouseId);
    if (needPieces > 0) {
      const currentPieces = await getStockPieces(tx, productId, warehouseId);
      throw new Error(
        `Stock insuficiente. Disponible: ${current} kg / ${currentPieces} pzas, solicitado: ${needQty} kg / ${needPieces} pzas`
      );
    }
    throw new Error(
      `Stock insuficiente. Disponible: ${current}, solicitado: ${needQty}`
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
  quantity: number;               // Siempre positivo, en la unidad de `presentationId` (o base si se omite). El signo lo determina movementType. En catch-weight es el peso REAL capturado en kg.
  presentationId?: number;
  movementType: "entry" | "exit" | "adjustment";
  adjustmentSign?: "positive" | "negative"; // requerido si movementType === "adjustment"
  /** Costo por unidad. Si hay presentationId, se interpreta por unidad de PRESENTACI\u00d3N (se divide por el factor para obtener costo por unidad base). */
  unitCost?: number;
  /**
   * Piezas fungibles (catch-weight), siempre positivo \u2014 el signo lo da
   * movementType/adjustmentSign, igual que quantity. Obligatorio para
   * productos catch-weight en entry/exit (>=1) y en adjustment (>=0; 0 es el
   * caso especial de merma solo-kg, ver comentario abajo). Prohibido en
   * productos normales.
   */
  pieces?: number;
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
        select: { allowNegative: true, unit: true, isCatchWeight: true },
      });
      if (!product) throw new Error(`Producto ${data.productId} no existe`);
      const allowNegative = product.allowNegative ?? false;

      if (!product.isCatchWeight && data.pieces != null) {
        throw new Error(
          "El producto no es de peso variable (catch-weight); no debe indicar piezas"
        );
      }

      // `pieces` es el valor de negocio (incluye 0 en merma solo-kg, usado
      // para calcular piecesDelta). `piecesForStorage` es lo que se persiste
      // en StockMovement.pieces: el CHECK exige NULL o > 0, así que el caso
      // "0 piezas" se guarda como NULL (no hubo piezas fisicas involucradas).
      let pieces = 0;
      let piecesForStorage: number | null = null;
      if (product.isCatchWeight) {
        if (data.pieces == null || !Number.isInteger(data.pieces)) {
          throw new Error(
            "Debe indicar las piezas (entero) para un producto de peso variable"
          );
        }
        const minPieces = data.movementType === "adjustment" ? 0 : 1;
        if (data.pieces < minPieces) {
          throw new Error(
            minPieces === 1
              ? "Las piezas deben ser un entero mayor o igual a 1"
              : "Las piezas deben ser un entero mayor o igual a 0"
          );
        }
        pieces = data.pieces;
        piecesForStorage = data.pieces > 0 ? data.pieces : null;
      }

      const { presentationId, factor, baseQuantity, equivalenceNote } = await resolvePresentation(tx, {
        productId: data.productId,
        presentationId: data.presentationId,
        quantity: data.quantity,
        productUnit: product.unit,
      });

      // Catch-weight: la baseQuantity real viene del peso capturado en
      // bascula, no del factor nominal de la presentacion (que solo estima).
      // Se revalida aqui con la misma regla de negocio de catchWeightBaseQuantity
      // (finito y > 0) para no aceptar pesos invalidos con presentationId.
      const effectiveBaseQuantity = product.isCatchWeight
        ? catchWeightBaseQuantity(data.quantity)
        : baseQuantity;

      // Costo por unidad base: si el costo del input viene por presentaci\u00f3n,
      // se divide por el factor (ej. $550 la caja de 24 = $22.9166... la lata).
      const unitCostPerBase = data.unitCost != null ? data.unitCost / factor : undefined;

      // Calcular delta firmado sobre StockLevel (en unidad base) y sobre piezas.
      let delta = 0;
      let piecesDelta = 0;
      if (data.movementType === "entry") {
        delta = effectiveBaseQuantity;
        piecesDelta = pieces;
      } else if (data.movementType === "exit") {
        delta = -effectiveBaseQuantity;
        piecesDelta = -pieces;
      } else if (data.movementType === "adjustment") {
        if (!data.adjustmentSign) {
          throw new Error("Debe indicar si el ajuste es positivo o negativo");
        }
        const sign = data.adjustmentSign === "positive" ? 1 : -1;
        delta = sign * effectiveBaseQuantity;
        // Merma solo-kg (ej. deshidratacion durante almacenaje): pieces=0
        // explicito en un ajuste catch-weight mueve el peso sin tocar el
        // contador de piezas, porque no se perdieron piezas completas.
        piecesDelta = pieces ? sign * pieces : 0;
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
        piecesDelta,
      });

      let actualUnitCost = unitCostPerBase ?? null;

      // Valuaci\u00f3n: entrada
      if (data.movementType === "entry") {
        await applyInventoryEntry(tx, {
          productId: data.productId,
          warehouseId: data.warehouseId,
          qty: effectiveBaseQuantity,
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
          qty: effectiveBaseQuantity,
        });
        if (actualUnitCost == null) actualUnitCost = exit.avgCostUsed;
      } else if (data.movementType === "adjustment" && delta > 0) {
        // Ajuste positivo sin costo se registra como entrada a costo 0
        await applyInventoryEntry(tx, {
          productId: data.productId,
          warehouseId: data.warehouseId,
          qty: effectiveBaseQuantity,
          unitCost: unitCostPerBase ?? 0,
          sourceType: "adjustment_entry",
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId: data.productId,
          warehouseId: data.warehouseId,
          quantity: effectiveBaseQuantity,
          pieces: piecesForStorage,
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
          baseQuantity: effectiveBaseQuantity,
          pieces,
          piecesDelta,
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
  /** Piezas fungibles (catch-weight), obligatorio (>=1) para productos catch-weight; prohibido en productos normales. */
  pieces?: number;
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
        select: { allowNegative: true, unit: true, isCatchWeight: true },
      });
      if (!product) throw new Error(`Producto ${data.productId} no existe`);
      const allowNegative = product.allowNegative ?? false;

      if (!product.isCatchWeight && data.pieces != null) {
        throw new Error(
          "El producto no es de peso variable (catch-weight); no debe indicar piezas"
        );
      }

      let pieces = 0;
      if (product.isCatchWeight) {
        if (data.pieces == null || !Number.isInteger(data.pieces) || data.pieces < 1) {
          throw new Error(
            "Debe indicar las piezas (entero mayor o igual a 1) para transferir un producto de peso variable"
          );
        }
        pieces = data.pieces;
      }

      const { presentationId, factor, baseQuantity, equivalenceNote } = await resolvePresentation(tx, {
        productId: data.productId,
        presentationId: data.presentationId,
        quantity: data.quantity,
        productUnit: product.unit,
      });

      // Catch-weight: la baseQuantity real viene del peso capturado, no del
      // factor nominal de la presentacion. Ver misma logica en createStockMovement.
      const effectiveBaseQuantity = product.isCatchWeight
        ? catchWeightBaseQuantity(data.quantity)
        : baseQuantity;

      const piecesForStorage = pieces > 0 ? pieces : null;

      // Descontar del almacen origen de forma atomica (salvo producto con
      // allowNegative). Si no alcanza, lanza el error de stock insuficiente
      // antes de tocar la valuacion, igual que el comportamiento anterior.
      // Siempre en unidad base. En catch-weight, kg y piezas se descuentan
      // en la misma operacion atomica (ver applyStockLevelDelta).
      await applyStockLevelDelta(tx, {
        productId: data.productId,
        warehouseId: data.warehouseIdFrom,
        delta: -effectiveBaseQuantity,
        allowNegative,
        piecesDelta: -pieces,
      });

      const noteBase = data.notes
        ? `${data.notes} | Transferencia${equivalenceNote}`
        : `Transferencia entre almacenes${equivalenceNote}`;

      // Valuaci\u00f3n: mover costo entre almacenes (en unidad base)
      const { avgCostUsed } = await applyInventoryTransfer(tx, {
        productId: data.productId,
        warehouseIdFrom: data.warehouseIdFrom,
        warehouseIdTo: data.warehouseIdTo,
        qty: effectiveBaseQuantity,
      });

      // Salida del almacen origen
      const outMovement = await tx.stockMovement.create({
        data: {
          productId: data.productId,
          warehouseId: data.warehouseIdFrom,
          quantity: effectiveBaseQuantity,
          pieces: piecesForStorage,
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
          quantity: effectiveBaseQuantity,
          pieces: piecesForStorage,
          movementType: "transfer",
          unitCost: avgCostUsed,
          referenceDoc: data.referenceDoc || null,
          notes: `${noteBase} <- almacen ${data.warehouseIdFrom}`,
          createdBy: userId,
        },
      });

      await upsertStockLevel(tx, data.productId, data.warehouseIdTo, effectiveBaseQuantity, pieces);

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
          baseQuantity: effectiveBaseQuantity,
          pieces: piecesForStorage,
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
