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
import { catchWeightBaseQuantity } from "@/modules/inventory/lib/units";
import {
  applyStockLevelDelta,
  upsertStockLevel,
} from "@/modules/inventory/lib/stock-level";
import {
  getPiecesForProduct,
  getPieceReconciliation,
  type ProductPieceRow,
  type PieceReconciliationRow,
} from "@/modules/inventory/queries/piece-queries";

const AUTH_ERROR_MESSAGE = "No autenticado";
const SESSION_ERROR_RESPONSE =
  "Tu sesión expiró o no iniciaste sesión. Vuelve a iniciar sesión e intenta de nuevo.";

function toUserMessage(error: unknown, genericMessage: string): string {
  if (error instanceof Error) {
    if (error.message === AUTH_ERROR_MESSAGE) return SESSION_ERROR_RESPONSE;
    if (
      error.message.startsWith("Stock insuficiente") ||
      error.message.startsWith("Stock FIFO insuficiente") ||
      error.message.startsWith("La pieza ") ||
      error.message.startsWith("Las piezas ") ||
      error.message.startsWith("Los pesajes ") ||
      error.message.startsWith("El producto ") ||
      error.message.includes("almacén origen y destino") ||
      error.message.includes("peso variable")
    ) {
      return error.message;
    }
  }
  return genericMessage;
}

function pieceName(piece: { pieceId: number; label: string | null }): string {
  return piece.label ?? `#${piece.pieceId}`;
}

// -----------------------------------------------------------------------------
// TRANSFERENCIA de piezas específicas entre almacenes
// -----------------------------------------------------------------------------
export async function transferPieces(data: {
  pieceIds: number[];
  warehouseIdTo: number;
  referenceDoc?: string;
  notes?: string;
}): Promise<ActionResult<{ outMovementId: number; inMovementId: number }>> {
  try {
    if (!data.pieceIds.length) {
      return { success: false, error: "Selecciona al menos una pieza" };
    }
    if (new Set(data.pieceIds).size !== data.pieceIds.length) {
      return { success: false, error: "Hay piezas repetidas en la transferencia" };
    }

    const userId = await requireCurrentUserId();

    const result = await db.$transaction(async (tx) => {
      const pieces = await tx.productPiece.findMany({
        where: { pieceId: { in: data.pieceIds } },
      });
      if (pieces.length !== data.pieceIds.length) {
        throw new Error("La pieza seleccionada no existe");
      }
      const [first] = pieces;
      if (pieces.some((p) => p.productId !== first.productId)) {
        throw new Error("Las piezas deben ser del mismo producto para transferirse juntas");
      }
      if (pieces.some((p) => p.warehouseId !== first.warehouseId)) {
        throw new Error("Las piezas deben estar en el mismo almacén de origen");
      }
      if (first.warehouseId === data.warehouseIdTo) {
        throw new Error("El almacén origen y destino deben ser diferentes");
      }
      const unavailable = pieces.find((p) => p.status !== "available");
      if (unavailable) {
        throw new Error(
          `La pieza ${pieceName(unavailable)} ya no está disponible (${unavailable.status})`
        );
      }
      const product = await tx.product.findUnique({
        where: { productId: first.productId },
        select: { name: true, unit: true },
      });

      // Reclamo atómico por pieza: cambia warehouseId solo si sigue disponible
      // en el origen con el peso leído (un re-pesaje o venta concurrente
      // invalida la operación completa).
      for (const p of pieces) {
        const claimed = await tx.productPiece.updateMany({
          where: {
            pieceId: p.pieceId,
            warehouseId: first.warehouseId,
            status: "available",
            weightKg: p.weightKg,
          },
          data: { warehouseId: data.warehouseIdTo },
        });
        if (claimed.count !== 1) {
          throw new Error(
            `La pieza ${pieceName(p)} ya no está disponible. Recarga e intenta de nuevo.`
          );
        }
      }

      const totalKg = catchWeightBaseQuantity(
        pieces.reduce((s, p) => s + Number(p.weightKg), 0)
      );
      const totalPieces = pieces.reduce((s, p) => s + p.pieceCount, 0);
      const labels = pieces.map(pieceName).join(", ");

      // Agregados: descuenta origen (atómico kg+piezas), mueve valuación,
      // incrementa destino — misma mecánica que createStockTransfer.
      await applyStockLevelDelta(tx, {
        productId: first.productId,
        warehouseId: first.warehouseId,
        delta: -totalKg,
        allowNegative: false,
        piecesDelta: -totalPieces,
      });

      const { avgCostUsed } = await applyInventoryTransfer(tx, {
        productId: first.productId,
        warehouseIdFrom: first.warehouseId,
        warehouseIdTo: data.warehouseIdTo,
        qty: totalKg,
      });

      const noteBase = data.notes
        ? `${data.notes} | Transferencia de piezas ${labels}`
        : `Transferencia de piezas ${labels}`;

      const outMovement = await tx.stockMovement.create({
        data: {
          productId: first.productId,
          warehouseId: first.warehouseId,
          quantity: totalKg,
          pieces: totalPieces,
          movementType: "transfer",
          unitCost: avgCostUsed,
          referenceDoc: data.referenceDoc || null,
          notes: `${noteBase} -> almacen ${data.warehouseIdTo}`,
          createdBy: userId,
        },
      });

      const inMovement = await tx.stockMovement.create({
        data: {
          productId: first.productId,
          warehouseId: data.warehouseIdTo,
          quantity: totalKg,
          pieces: totalPieces,
          movementType: "transfer",
          unitCost: avgCostUsed,
          referenceDoc: data.referenceDoc || null,
          notes: `${noteBase} <- almacen ${first.warehouseId}`,
          createdBy: userId,
        },
      });

      await upsertStockLevel(tx, first.productId, data.warehouseIdTo, totalKg, totalPieces);

      await createAuditLog(tx, {
        action: "create",
        entityType: "PieceTransfer",
        entityId: outMovement.movementId,
        module: "inventory",
        userId,
        newValues: {
          productId: first.productId,
          productName: product?.name,
          pieceIds: data.pieceIds,
          warehouseIdFrom: first.warehouseId,
          warehouseIdTo: data.warehouseIdTo,
          totalKg,
          totalPieces,
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
    console.error("transferPieces:", error);
    return { success: false, error: toUserMessage(error, "Error al transferir las piezas") };
  }
}

// -----------------------------------------------------------------------------
// BAJA / MERMA de una pieza completa
// -----------------------------------------------------------------------------
export async function disposePiece(data: {
  pieceId: number;
  reason: string;
}): Promise<ActionResult<{ movementId: number }>> {
  try {
    if (!data.reason.trim()) {
      return { success: false, error: "Indica el motivo de la baja" };
    }

    const userId = await requireCurrentUserId();

    const result = await db.$transaction(async (tx) => {
      const piece = await tx.productPiece.findUnique({
        where: { pieceId: data.pieceId },
      });
      if (!piece) throw new Error("La pieza seleccionada no existe");
      if (piece.status !== "available") {
        throw new Error(`La pieza ${pieceName(piece)} ya no está disponible (${piece.status})`);
      }

      const claimed = await tx.productPiece.updateMany({
        where: {
          pieceId: piece.pieceId,
          status: "available",
          weightKg: piece.weightKg,
        },
        data: {
          status: "disposed",
          disposedAt: new Date(),
          disposedReason: data.reason.trim(),
        },
      });
      if (claimed.count !== 1) {
        throw new Error(
          `La pieza ${pieceName(piece)} ya no está disponible. Recarga e intenta de nuevo.`
        );
      }

      const kg = catchWeightBaseQuantity(Number(piece.weightKg));

      await applyStockLevelDelta(tx, {
        productId: piece.productId,
        warehouseId: piece.warehouseId,
        delta: -kg,
        allowNegative: false,
        piecesDelta: -piece.pieceCount,
      });

      const exit = await applyInventoryExit(tx, {
        productId: piece.productId,
        warehouseId: piece.warehouseId,
        qty: kg,
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: piece.productId,
          warehouseId: piece.warehouseId,
          quantity: kg,
          pieces: piece.pieceCount,
          movementType: "adjustment",
          unitCost: exit.avgCostUsed,
          notes: `Baja de pieza ${pieceName(piece)}: ${data.reason.trim()}`,
          createdBy: userId,
        },
      });

      await createAuditLog(tx, {
        action: "create",
        entityType: "PieceDisposal",
        entityId: piece.pieceId,
        module: "inventory",
        userId,
        newValues: {
          pieceId: piece.pieceId,
          productId: piece.productId,
          warehouseId: piece.warehouseId,
          weightKg: kg,
          pieceCount: piece.pieceCount,
          reason: data.reason.trim(),
          movementId: movement.movementId,
        },
      });

      return movement;
    });

    revalidatePath("/stock");
    return { success: true, data: { movementId: result.movementId } };
  } catch (error) {
    console.error("disposePiece:", error);
    return { success: false, error: toUserMessage(error, "Error al dar de baja la pieza") };
  }
}

// -----------------------------------------------------------------------------
// RE-PESAJE / corrección de peso de una pieza (merma parcial de kg)
// -----------------------------------------------------------------------------
export async function reweighPiece(data: {
  pieceId: number;
  newWeightKg: number;
  version: number;
}): Promise<ActionResult<{ movementId: number | null }>> {
  try {
    if (!Number.isFinite(data.newWeightKg) || data.newWeightKg <= 0) {
      return { success: false, error: "El peso debe ser mayor a 0" };
    }

    const userId = await requireCurrentUserId();

    const result = await db.$transaction(async (tx) => {
      const piece = await tx.productPiece.findUnique({
        where: { pieceId: data.pieceId },
      });
      if (!piece) throw new Error("La pieza seleccionada no existe");
      if (piece.status !== "available") {
        throw new Error(`La pieza ${pieceName(piece)} ya no está disponible (${piece.status})`);
      }

      const oldKg = catchWeightBaseQuantity(Number(piece.weightKg));
      const newKg = catchWeightBaseQuantity(data.newWeightKg);
      const deltaKg = catchWeightBaseQuantity(Math.abs(newKg - oldKg)) * Math.sign(newKg - oldKg);

      // Optimistic locking (patrón version del repo): si otra operación tocó
      // la pieza entre lectura y update, count 0 y el usuario reintenta.
      const updated = await tx.productPiece.updateMany({
        where: {
          pieceId: piece.pieceId,
          version: data.version,
          status: "available",
        },
        data: {
          weightKg: newKg,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new Error(
          `La pieza ${pieceName(piece)} fue modificada por otra operación. Recarga e intenta de nuevo.`
        );
      }

      if (deltaKg === 0) return { movementId: null };

      // Ajuste SOLO-kg sobre los agregados: el conteo de piezas no cambia
      // (misma semántica que la merma pieces=0 de createStockMovement).
      await applyStockLevelDelta(tx, {
        productId: piece.productId,
        warehouseId: piece.warehouseId,
        delta: deltaKg,
        allowNegative: false,
        piecesDelta: 0,
      });

      let unitCost: number | null = null;
      if (deltaKg < 0) {
        const exit = await applyInventoryExit(tx, {
          productId: piece.productId,
          warehouseId: piece.warehouseId,
          qty: Math.abs(deltaKg),
        });
        unitCost = exit.avgCostUsed;
      } else {
        // Corrección al alza sin costo conocido: entrada a costo 0, igual que
        // un ajuste positivo sin costo en createStockMovement.
        await applyInventoryEntry(tx, {
          productId: piece.productId,
          warehouseId: piece.warehouseId,
          qty: deltaKg,
          unitCost: 0,
          sourceType: "adjustment_entry",
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId: piece.productId,
          warehouseId: piece.warehouseId,
          quantity: Math.abs(deltaKg),
          pieces: null,
          movementType: "adjustment",
          unitCost,
          notes: `Re-pesaje pieza ${pieceName(piece)}: ${oldKg} kg -> ${newKg} kg`,
          createdBy: userId,
        },
      });

      await createAuditLog(tx, {
        action: "update",
        entityType: "PieceReweigh",
        entityId: piece.pieceId,
        module: "inventory",
        userId,
        oldValues: { weightKg: oldKg },
        newValues: {
          weightKg: newKg,
          deltaKg,
          movementId: movement.movementId,
        },
      });

      return { movementId: movement.movementId };
    });

    revalidatePath("/stock");
    return { success: true, data: { movementId: result.movementId } };
  } catch (error) {
    console.error("reweighPiece:", error);
    return { success: false, error: toUserMessage(error, "Error al re-pesar la pieza") };
  }
}

// -----------------------------------------------------------------------------
// ALTA MANUAL de piezas para stock existente (no toca StockLevel)
// -----------------------------------------------------------------------------
export interface InitialPieceInput {
  weightKg: number;
  pieceCount?: number;
  presentationId?: number;
  label?: string;
}

export async function registerInitialPieces(data: {
  productId: number;
  warehouseId: number;
  pieces: InitialPieceInput[];
}): Promise<ActionResult<{ created: number }>> {
  try {
    if (!data.pieces.length) {
      return { success: false, error: "Captura al menos un pesaje" };
    }
    for (const p of data.pieces) {
      if (!Number.isFinite(p.weightKg) || p.weightKg <= 0) {
        return { success: false, error: "Cada peso debe ser mayor a 0" };
      }
      if (p.pieceCount != null && (!Number.isInteger(p.pieceCount) || p.pieceCount < 1)) {
        return { success: false, error: "Las piezas por pesaje deben ser un entero mayor o igual a 1" };
      }
    }

    const userId = await requireCurrentUserId();

    const created = await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { productId: data.productId },
        select: { name: true, isCatchWeight: true },
      });
      if (!product) throw new Error(`Producto ${data.productId} no existe`);
      if (!product.isCatchWeight) {
        throw new Error(`El producto ${product.name} no es de peso variable`);
      }

      // Cuadre contra los agregados: las piezas describen stock que YA existe,
      // así que registrado + nuevo no puede exceder StockLevel. La validación
      // vive en la misma tx; dos altas simultáneas podrían colarse (sin locks),
      // pero el panel de cuadre evidencia cualquier exceso y se corrige con baja.
      const level = await tx.stockLevel.findUnique({
        where: {
          productId_warehouseId: {
            productId: data.productId,
            warehouseId: data.warehouseId,
          },
        },
      });
      const currentKg = level ? Number(level.currentQuantity) : 0;
      const currentPieces = level?.currentPieces ?? 0;

      const registered = await tx.productPiece.aggregate({
        where: {
          productId: data.productId,
          warehouseId: data.warehouseId,
          status: "available",
        },
        _sum: { weightKg: true, pieceCount: true },
      });
      const registeredKg = Number(registered._sum.weightKg ?? 0);
      const registeredPieces = registered._sum.pieceCount ?? 0;

      const newKg = data.pieces.reduce((s, p) => s + p.weightKg, 0);
      const newPieces = data.pieces.reduce((s, p) => s + (p.pieceCount ?? 1), 0);

      const remainingKg = currentKg - registeredKg;
      const remainingPieces = currentPieces - registeredPieces;
      if (newKg > remainingKg + 0.001 || newPieces > remainingPieces) {
        throw new Error(
          `Los pesajes exceden el stock sin registrar (${remainingKg.toFixed(3)} kg / ${remainingPieces} pzas disponibles)`
        );
      }

      await tx.productPiece.createMany({
        data: data.pieces.map((p) => ({
          productId: data.productId,
          warehouseId: data.warehouseId,
          presentationId: p.presentationId ?? null,
          weightKg: catchWeightBaseQuantity(p.weightKg),
          pieceCount: p.pieceCount ?? 1,
          label: p.label?.trim() || null,
          registeredBy: userId,
        })),
      });

      await createAuditLog(tx, {
        action: "create",
        entityType: "PieceInitialRegistration",
        entityId: data.productId,
        module: "inventory",
        userId,
        newValues: {
          productId: data.productId,
          warehouseId: data.warehouseId,
          count: data.pieces.length,
          totalKg: newKg,
          totalPieces: newPieces,
        },
      });

      return data.pieces.length;
    });

    revalidatePath("/stock");
    revalidatePath("/stock/pesajes");
    return { success: true, data: { created } };
  } catch (error) {
    console.error("registerInitialPieces:", error);
    return { success: false, error: toUserMessage(error, "Error al registrar los pesajes") };
  }
}

// -----------------------------------------------------------------------------
// LECTURA on-demand de piezas disponibles (POS / diálogos)
// -----------------------------------------------------------------------------
export interface AvailablePiece {
  pieceId: number;
  weightKg: number;
  pieceCount: number;
  presentationId: number | null;
  label: string | null;
  version: number;
  registeredAt: string;
}

export async function getProductPiecesAction(
  productId: number
): Promise<ActionResult<{ pieces: ProductPieceRow[] }>> {
  try {
    const pieces = await getPiecesForProduct(productId);
    return { success: true, data: { pieces } };
  } catch (error) {
    console.error("getProductPiecesAction:", error);
    return { success: false, error: "Error al cargar los pesajes del producto" };
  }
}

export async function getPieceReconciliationAction(
  productId: number
): Promise<ActionResult<{ rows: PieceReconciliationRow[] }>> {
  try {
    const rows = await getPieceReconciliation(productId);
    return { success: true, data: { rows } };
  } catch (error) {
    console.error("getPieceReconciliationAction:", error);
    return { success: false, error: "Error al cargar el cuadre de pesajes" };
  }
}

export async function getAvailablePiecesAction(
  productId: number,
  warehouseId: number
): Promise<ActionResult<{ pieces: AvailablePiece[] }>> {
  try {
    const rows = await db.productPiece.findMany({
      where: { productId, warehouseId, status: "available" },
      orderBy: [{ weightKg: "asc" }, { pieceId: "asc" }],
    });
    return {
      success: true,
      data: {
        pieces: rows.map((p) => ({
          pieceId: p.pieceId,
          weightKg: Number(p.weightKg),
          pieceCount: p.pieceCount,
          presentationId: p.presentationId,
          label: p.label,
          version: p.version,
          registeredAt: p.registeredAt.toISOString(),
        })),
      },
    };
  } catch (error) {
    console.error("getAvailablePiecesAction:", error);
    return { success: false, error: "Error al cargar las piezas disponibles" };
  }
}
