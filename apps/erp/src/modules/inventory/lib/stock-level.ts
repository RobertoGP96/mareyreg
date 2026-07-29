import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;

export async function getStockQty(
  tx: PrismaTx,
  productId: number,
  warehouseId: number
): Promise<number> {
  const level = await tx.stockLevel.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  return level ? Number(level.currentQuantity) : 0;
}

export async function getStockPieces(
  tx: PrismaTx,
  productId: number,
  warehouseId: number
): Promise<number> {
  const level = await tx.stockLevel.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  return level?.currentPieces ?? 0;
}

export async function upsertStockLevel(
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
export async function applyStockLevelDelta(
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
