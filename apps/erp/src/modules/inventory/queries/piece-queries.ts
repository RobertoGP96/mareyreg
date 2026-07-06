import { db } from "@/lib/db";
import type { PieceStatus } from "@/generated/prisma";

export interface ProductPieceRow {
  pieceId: number;
  productId: number;
  warehouseId: number;
  warehouseName: string;
  presentationName: string | null;
  weightKg: number;
  pieceCount: number;
  status: PieceStatus;
  label: string | null;
  version: number;
  registeredAt: string;
  soldAt: string | null;
  disposedAt: string | null;
  disposedReason: string | null;
}

export async function getPiecesForProduct(
  productId: number,
  opts: { warehouseId?: number; status?: PieceStatus[] } = {}
): Promise<ProductPieceRow[]> {
  const rows = await db.productPiece.findMany({
    where: {
      productId,
      ...(opts.warehouseId != null ? { warehouseId: opts.warehouseId } : {}),
      ...(opts.status?.length ? { status: { in: opts.status } } : {}),
    },
    include: {
      warehouse: { select: { name: true } },
      presentation: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { warehouseId: "asc" }, { weightKg: "asc" }],
  });

  return rows.map((p) => ({
    pieceId: p.pieceId,
    productId: p.productId,
    warehouseId: p.warehouseId,
    warehouseName: p.warehouse.name,
    presentationName: p.presentation?.name ?? null,
    weightKg: Number(p.weightKg),
    pieceCount: p.pieceCount,
    status: p.status,
    label: p.label,
    version: p.version,
    registeredAt: p.registeredAt.toISOString(),
    soldAt: p.soldAt?.toISOString() ?? null,
    disposedAt: p.disposedAt?.toISOString() ?? null,
    disposedReason: p.disposedReason,
  }));
}

export interface PieceReconciliationRow {
  warehouseId: number;
  warehouseName: string;
  /** Agregados de StockLevel (fuente de verdad). */
  currentKg: number;
  currentPieces: number;
  /** Suma de piezas registradas disponibles. */
  registeredKg: number;
  registeredPieces: number;
  /** Remanente sin registrar (puede venderse solo con peso manual). */
  remainingKg: number;
  remainingPieces: number;
}

/**
 * Cuadre piezas registradas vs agregados de StockLevel por almacén.
 * Invariante sana: registered <= current (las piezas son un subconjunto
 * descriptivo del stock). remaining negativo evidencia un descuadre a
 * corregir con baja o re-pesaje.
 */
export async function getPieceReconciliation(
  productId: number
): Promise<PieceReconciliationRow[]> {
  const [levels, registered] = await Promise.all([
    db.stockLevel.findMany({
      where: { productId },
      include: { warehouse: { select: { name: true } } },
    }),
    db.productPiece.groupBy({
      by: ["warehouseId"],
      where: { productId, status: "available" },
      _sum: { weightKg: true, pieceCount: true },
    }),
  ]);

  const registeredByWarehouse = new Map(
    registered.map((r) => [
      r.warehouseId,
      {
        kg: Number(r._sum.weightKg ?? 0),
        pieces: r._sum.pieceCount ?? 0,
      },
    ])
  );

  return levels.map((lvl) => {
    const reg = registeredByWarehouse.get(lvl.warehouseId) ?? { kg: 0, pieces: 0 };
    const currentKg = Number(lvl.currentQuantity);
    return {
      warehouseId: lvl.warehouseId,
      warehouseName: lvl.warehouse.name,
      currentKg,
      currentPieces: lvl.currentPieces,
      registeredKg: reg.kg,
      registeredPieces: reg.pieces,
      remainingKg: currentKg - reg.kg,
      remainingPieces: lvl.currentPieces - reg.pieces,
    };
  });
}
