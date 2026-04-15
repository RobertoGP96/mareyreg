import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;

export interface EntryInput {
  productId: number;
  warehouseId: number;
  qty: number;
  unitCost: number;
  lotId?: number | null;
  sourceType?: string;
  sourceId?: number;
}

export interface ExitInput {
  productId: number;
  warehouseId: number;
  qty: number;
}

export interface ExitResult {
  avgCostUsed: number;
  totalCostConsumed: number;
}

async function resolveMethod(
  tx: PrismaTx,
  productId: number
): Promise<"fifo" | "average"> {
  const product = await tx.product.findUnique({
    where: { productId },
    select: { valuationMethod: true },
  });
  return product?.valuationMethod ?? "average";
}

// -----------------------------------------------------------------------------
// ENTRY
// -----------------------------------------------------------------------------
export async function applyInventoryEntry(
  tx: PrismaTx,
  input: EntryInput
): Promise<void> {
  const method = await resolveMethod(tx, input.productId);
  const entryCost = input.qty * input.unitCost;

  // Average: mantener contadores globales por product+warehouse
  await tx.productValuation.upsert({
    where: {
      productId_warehouseId: {
        productId: input.productId,
        warehouseId: input.warehouseId,
      },
    },
    create: {
      productId: input.productId,
      warehouseId: input.warehouseId,
      totalCost: entryCost,
      totalQty: input.qty,
    },
    update: {
      totalCost: { increment: entryCost },
      totalQty: { increment: input.qty },
    },
  });

  // FIFO: crear capa
  if (method === "fifo") {
    await tx.inventoryLayer.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        lotId: input.lotId ?? null,
        unitCost: input.unitCost,
        quantityOpen: input.qty,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
      },
    });
  }
}

// -----------------------------------------------------------------------------
// EXIT
// -----------------------------------------------------------------------------
export async function applyInventoryExit(
  tx: PrismaTx,
  input: ExitInput
): Promise<ExitResult> {
  const method = await resolveMethod(tx, input.productId);

  if (method === "fifo") {
    return consumeFifo(tx, input);
  }
  return consumeAverage(tx, input);
}

async function consumeAverage(tx: PrismaTx, input: ExitInput): Promise<ExitResult> {
  const val = await tx.productValuation.findUnique({
    where: {
      productId_warehouseId: {
        productId: input.productId,
        warehouseId: input.warehouseId,
      },
    },
  });
  const totalQty = val ? Number(val.totalQty) : 0;
  const totalCost = val ? Number(val.totalCost) : 0;
  const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
  const costConsumed = avgCost * input.qty;

  if (val) {
    await tx.productValuation.update({
      where: {
        productId_warehouseId: {
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
      data: {
        totalQty: { decrement: input.qty },
        totalCost: { decrement: costConsumed },
      },
    });
  }

  return { avgCostUsed: avgCost, totalCostConsumed: costConsumed };
}

async function consumeFifo(tx: PrismaTx, input: ExitInput): Promise<ExitResult> {
  const layers = await tx.inventoryLayer.findMany({
    where: {
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantityOpen: { gt: 0 },
    },
    orderBy: { enteredAt: "asc" },
  });

  let remaining = input.qty;
  let costConsumed = 0;

  for (const layer of layers) {
    if (remaining <= 0) break;
    const open = Number(layer.quantityOpen);
    const take = Math.min(open, remaining);
    const layerUnitCost = Number(layer.unitCost);
    costConsumed += take * layerUnitCost;
    remaining -= take;

    await tx.inventoryLayer.update({
      where: { layerId: layer.layerId },
      data: { quantityOpen: { decrement: take } },
    });
  }

  if (remaining > 0) {
    // No hay suficientes capas FIFO. Esto no deber\u00eda pasar si StockLevel se valid\u00f3 antes,
    // pero dejamos el error como seguro.
    throw new Error(
      `Stock FIFO insuficiente para producto ${input.productId} en almacen ${input.warehouseId}`
    );
  }

  // Sincronizar ProductValuation (tambi\u00e9n \u00fatil para reportes de valuaci\u00f3n)
  const val = await tx.productValuation.findUnique({
    where: {
      productId_warehouseId: {
        productId: input.productId,
        warehouseId: input.warehouseId,
      },
    },
  });
  if (val) {
    await tx.productValuation.update({
      where: {
        productId_warehouseId: {
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
      data: {
        totalQty: { decrement: input.qty },
        totalCost: { decrement: costConsumed },
      },
    });
  }

  const avg = input.qty > 0 ? costConsumed / input.qty : 0;
  return { avgCostUsed: avg, totalCostConsumed: costConsumed };
}

/**
 * Transfer cost from one warehouse to another. The outgoing warehouse loses
 * cost using its own valuation method; the incoming warehouse gains the same cost.
 */
export async function applyInventoryTransfer(
  tx: PrismaTx,
  params: {
    productId: number;
    warehouseIdFrom: number;
    warehouseIdTo: number;
    qty: number;
  }
): Promise<{ avgCostUsed: number }> {
  const exit = await applyInventoryExit(tx, {
    productId: params.productId,
    warehouseId: params.warehouseIdFrom,
    qty: params.qty,
  });

  await applyInventoryEntry(tx, {
    productId: params.productId,
    warehouseId: params.warehouseIdTo,
    qty: params.qty,
    unitCost: exit.avgCostUsed,
    sourceType: "transfer",
  });

  return { avgCostUsed: exit.avgCostUsed };
}
