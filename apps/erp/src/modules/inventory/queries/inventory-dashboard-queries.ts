import { db } from "@/lib/db";

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Aggregated dashboard data for the inventory module.
 * Combines products, stock levels, valuations and movements for a control-room view.
 */
export async function getInventoryDashboard() {
  const since30 = daysAgoIso(30);

  const [
    productsCount,
    productsActiveCount,
    warehousesCount,
    valuation,
    stockLevels,
    movements30,
    recentMovements,
  ] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { isActive: true } }),
    db.warehouse.count({ where: { isActive: true } }),
    db.productValuation.aggregate({
      _sum: { totalCost: true, totalQty: true },
    }),
    db.stockLevel.findMany({
      include: {
        product: {
          select: {
            productId: true,
            name: true,
            unit: true,
            minStock: true,
            maxStock: true,
            reorderPoint: true,
            costPrice: true,
            category: true,
            isActive: true,
          },
        },
        warehouse: { select: { warehouseId: true, name: true } },
      },
    }),
    db.stockMovement.findMany({
      where: { createdAt: { gte: since30 } },
      select: {
        movementId: true,
        movementType: true,
        quantity: true,
        createdAt: true,
      },
    }),
    db.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        product: { select: { name: true, unit: true } },
        warehouse: { select: { name: true } },
      },
    }),
  ]);

  // Stock alerts (low / over)
  const lowStock: Array<{
    productId: number;
    warehouseId: number;
    productName: string;
    warehouseName: string;
    qty: number;
    min: number;
    unit: string;
  }> = [];
  const overStock: Array<{
    productId: number;
    warehouseId: number;
    productName: string;
    warehouseName: string;
    qty: number;
    max: number;
    unit: string;
  }> = [];
  const outOfStock: Array<{
    productId: number;
    warehouseId: number;
    productName: string;
    warehouseName: string;
    unit: string;
  }> = [];

  for (const l of stockLevels) {
    const qty = Number(l.currentQuantity);
    const min = Number(l.product.minStock);
    const reorder =
      l.product.reorderPoint != null ? Number(l.product.reorderPoint) : min;
    const max = l.product.maxStock != null ? Number(l.product.maxStock) : null;
    if (qty <= 0) {
      outOfStock.push({
        productId: l.productId,
        warehouseId: l.warehouseId,
        productName: l.product.name,
        warehouseName: l.warehouse.name,
        unit: l.product.unit,
      });
    } else if (qty <= reorder) {
      lowStock.push({
        productId: l.productId,
        warehouseId: l.warehouseId,
        productName: l.product.name,
        warehouseName: l.warehouse.name,
        qty,
        min,
        unit: l.product.unit,
      });
    }
    if (max !== null && qty > max) {
      overStock.push({
        productId: l.productId,
        warehouseId: l.warehouseId,
        productName: l.product.name,
        warehouseName: l.warehouse.name,
        qty,
        max,
        unit: l.product.unit,
      });
    }
  }

  // Stock by warehouse — qty + estimated value (qty * costPrice)
  const byWarehouseMap = new Map<
    number,
    { warehouseId: number; name: string; qty: number; value: number; skus: number }
  >();
  for (const l of stockLevels) {
    const cur =
      byWarehouseMap.get(l.warehouseId) ?? {
        warehouseId: l.warehouseId,
        name: l.warehouse.name,
        qty: 0,
        value: 0,
        skus: 0,
      };
    const qty = Number(l.currentQuantity);
    const cost = l.product.costPrice ? Number(l.product.costPrice) : 0;
    cur.qty += qty;
    cur.value += qty * cost;
    if (qty > 0) cur.skus += 1;
    byWarehouseMap.set(l.warehouseId, cur);
  }
  const byWarehouse = Array.from(byWarehouseMap.values()).sort(
    (a, b) => b.value - a.value
  );

  // Top stock value products (sum across warehouses)
  const byProductMap = new Map<
    number,
    {
      productId: number;
      name: string;
      unit: string;
      qty: number;
      value: number;
      category: string | null;
    }
  >();
  for (const l of stockLevels) {
    const cur =
      byProductMap.get(l.productId) ?? {
        productId: l.productId,
        name: l.product.name,
        unit: l.product.unit,
        qty: 0,
        value: 0,
        category: l.product.category,
      };
    const qty = Number(l.currentQuantity);
    const cost = l.product.costPrice ? Number(l.product.costPrice) : 0;
    cur.qty += qty;
    cur.value += qty * cost;
    byProductMap.set(l.productId, cur);
  }
  const topByValue = Array.from(byProductMap.values())
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Movements 30d — count + 14-day spark
  const spark14: number[] = Array.from({ length: 14 }, () => 0);
  let entriesCount = 0;
  let exitsCount = 0;
  let transfersCount = 0;
  let adjustmentsCount = 0;
  for (const m of movements30) {
    const diff = Math.floor(
      (Date.now() - new Date(m.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff >= 0 && diff < 14) spark14[13 - diff] += 1;
    if (m.movementType === "entry") entriesCount += 1;
    else if (m.movementType === "exit") exitsCount += 1;
    else if (m.movementType === "transfer") transfersCount += 1;
    else if (m.movementType === "adjustment") adjustmentsCount += 1;
  }

  // Active SKUs (with qty > 0 anywhere)
  const skusWithStock = new Set<number>();
  for (const l of stockLevels) {
    if (Number(l.currentQuantity) > 0) skusWithStock.add(l.productId);
  }

  return {
    counts: {
      products: productsCount,
      productsActive: productsActiveCount,
      warehouses: warehousesCount,
      skusWithStock: skusWithStock.size,
      totalQty: Number(valuation._sum.totalQty ?? 0),
      totalValue: Number(valuation._sum.totalCost ?? 0),
    },
    alerts: {
      low: lowStock,
      over: overStock,
      out: outOfStock,
    },
    movements30: {
      total: movements30.length,
      entries: entriesCount,
      exits: exitsCount,
      transfers: transfersCount,
      adjustments: adjustmentsCount,
      spark14,
    },
    recentMovements: recentMovements.map((m) => ({
      movementId: m.movementId,
      movementType: m.movementType,
      productName: m.product.name,
      warehouseName: m.warehouse.name,
      unit: m.product.unit,
      quantity: Number(m.quantity),
      createdAt: m.createdAt,
    })),
    byWarehouse,
    topByValue,
  };
}

export type InventoryDashboardData = Awaited<
  ReturnType<typeof getInventoryDashboard>
>;
