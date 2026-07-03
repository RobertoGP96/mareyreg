import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;

export interface EntryInput {
  productId: number;
  warehouseId: number;
  qty: number;
  unitCost: number; // Siempre en CUP (moneda base)
  lotId?: number | null;
  sourceType?: string;
  sourceId?: number;
  // Snapshot de la moneda original de compra (si difiere de la base). Se
  // persiste tal cual en la capa FIFO; no participa en el cálculo FIFO/promedio,
  // que siempre opera sobre unitCost (CUP).
  origCurrencyId?: number;
  origUnitCost?: number;
  exchangeRate?: number;
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

/**
 * Metodo de valuacion ya resuelto por el caller (p.ej. dispatchLines, que ya
 * cargo el producto en batch), para evitar el findUnique duplicado que hace
 * resolveMethod. Opcional: si se omite, el comportamiento es identico al
 * anterior (resuelve el metodo con un round-trip propio).
 */
export type PreResolvedMethod = "fifo" | "average";

async function resolveMethod(
  tx: PrismaTx,
  productId: number,
  preResolvedMethod?: PreResolvedMethod
): Promise<"fifo" | "average"> {
  if (preResolvedMethod) return preResolvedMethod;
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
  input: EntryInput,
  preResolvedMethod?: PreResolvedMethod
): Promise<void> {
  const method = await resolveMethod(tx, input.productId, preResolvedMethod);
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
        origCurrencyId: input.origCurrencyId ?? null,
        origUnitCost: input.origUnitCost ?? null,
        exchangeRate: input.exchangeRate ?? null,
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
  input: ExitInput,
  preResolvedMethod?: PreResolvedMethod
): Promise<ExitResult> {
  const method = await resolveMethod(tx, input.productId, preResolvedMethod);

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
    // Decremento condicional atomico: solo aplica si totalQty sigue siendo
    // >= input.qty en el momento del UPDATE (protege contra carreras entre
    // transacciones concurrentes sobre la misma fila de valuacion, dado que
    // Neon serverless no soporta SELECT FOR UPDATE confiable).
    const updated = await tx.productValuation.updateMany({
      where: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        totalQty: { gte: input.qty },
      },
      data: {
        totalQty: { decrement: input.qty },
        totalCost: { decrement: costConsumed },
      },
    });

    if (updated.count === 0) {
      // No se pudo garantizar totalQty >= qty de forma atomica (carrera o
      // dato stale). Se hace clamp defensivo a 0 para nunca dejar totalQty
      // negativo, preservando el comportamiento previo (best-effort) para
      // el caso sin concurrencia real: si el valor leido ya alcanzaba,
      // reintentamos un decremento simple acotado por clamp.
      await tx.productValuation.update({
        where: {
          productId_warehouseId: {
            productId: input.productId,
            warehouseId: input.warehouseId,
          },
        },
        data: {
          totalQty: Math.max(0, totalQty - input.qty),
          totalCost: Math.max(0, totalCost - costConsumed),
        },
      });
    }
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

    // Decremento condicional atomico: solo resta si quantityOpen sigue
    // siendo >= take en el momento del UPDATE, evitando dejar la capa en
    // negativo por una carrera con otra transaccion concurrente.
    const updated = await tx.inventoryLayer.updateMany({
      where: { layerId: layer.layerId, quantityOpen: { gte: take } },
      data: { quantityOpen: { decrement: take } },
    });

    if (updated.count === 0) {
      // La capa cambio entre el findMany y el update (consumida por otra
      // tx). No la contamos como consumida; el loop seguira con las
      // siguientes capas y, si no alcanza, cae en el error de abajo.
      continue;
    }

    costConsumed += take * layerUnitCost;
    remaining -= take;
  }

  if (remaining > 0) {
    // No hay suficientes capas FIFO. Esto no deber\u00eda pasar si StockLevel se valid\u00f3 antes,
    // pero dejamos el error como seguro.
    throw new Error(
      `Stock FIFO insuficiente para producto ${input.productId} en almacen ${input.warehouseId}`
    );
  }

  // Sincronizar ProductValuation (tambi\u00e9n \u00fatil para reportes de valuaci\u00f3n).
  // Las capas FIFO ya son la fuente de verdad de la cantidad consumida (protegidas
  // arriba con updateMany condicional); este espejo se actualiza con el mismo
  // decremento condicional y clamp defensivo para nunca dejar totalQty negativo.
  const val = await tx.productValuation.findUnique({
    where: {
      productId_warehouseId: {
        productId: input.productId,
        warehouseId: input.warehouseId,
      },
    },
  });
  if (val) {
    const totalQty = Number(val.totalQty);
    const totalCost = Number(val.totalCost);

    const updated = await tx.productValuation.updateMany({
      where: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        totalQty: { gte: input.qty },
      },
      data: {
        totalQty: { decrement: input.qty },
        totalCost: { decrement: costConsumed },
      },
    });

    if (updated.count === 0) {
      await tx.productValuation.update({
        where: {
          productId_warehouseId: {
            productId: input.productId,
            warehouseId: input.warehouseId,
          },
        },
        data: {
          totalQty: Math.max(0, totalQty - input.qty),
          totalCost: Math.max(0, totalCost - costConsumed),
        },
      });
    }
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
