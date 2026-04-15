import { db } from "@/lib/db";

export async function getInventoryValueSummary() {
  // Valor del inventario general (ProductValuation.totalCost)
  const inv = await db.productValuation.aggregate({
    _sum: { totalCost: true, totalQty: true },
  });

  // Valor Pacas (totalCost de pacaInventory)
  const pacas = await db.pacaInventory.aggregate({
    _sum: { totalCost: true, available: true, reserved: true },
  });

  return {
    inventoryValue: Number(inv._sum.totalCost ?? 0),
    inventoryQty: Number(inv._sum.totalQty ?? 0),
    pacasValue: Number(pacas._sum.totalCost ?? 0),
    pacasQty: Number(pacas._sum.available ?? 0) + Number(pacas._sum.reserved ?? 0),
  };
}

export async function getSalesSummary(from: Date, to: Date) {
  const [invoices, pacaSales] = await Promise.all([
    db.invoice.aggregate({
      where: {
        status: { not: "cancelled" },
        issueDate: { gte: from, lte: to },
      },
      _sum: { total: true },
      _count: true,
    }),
    db.pacaSale.aggregate({
      where: { createdAt: { gte: from, lte: to } },
      _sum: { salePrice: true, quantity: true },
      _count: true,
    }),
  ]);

  return {
    invoiceTotal: Number(invoices._sum.total ?? 0),
    invoiceCount: invoices._count,
    pacasTotal: Number(pacaSales._sum.salePrice ?? 0),
    pacasCount: pacaSales._count,
    combinedTotal:
      Number(invoices._sum.total ?? 0) + Number(pacaSales._sum.salePrice ?? 0),
  };
}

export async function getLowStockAlerts() {
  const levels = await db.stockLevel.findMany({
    include: {
      product: {
        select: {
          productId: true,
          name: true,
          minStock: true,
          reorderPoint: true,
          unit: true,
        },
      },
      warehouse: { select: { name: true } },
    },
  });
  return levels
    .filter((l) => {
      const q = Number(l.currentQuantity);
      const min = Number(l.product.minStock);
      const reorder = l.product.reorderPoint != null ? Number(l.product.reorderPoint) : min;
      return q <= reorder;
    })
    .slice(0, 50);
}

export async function getOverdueInvoices() {
  const now = new Date();
  return db.invoice.findMany({
    where: {
      status: { in: ["pending", "partial"] },
      dueDate: { lt: now },
    },
    include: { customer: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
    take: 20,
  });
}

export async function getSalesLast30Days() {
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const invoices = await db.invoice.findMany({
    where: { issueDate: { gte: from }, status: { not: "cancelled" } },
    select: { issueDate: true, total: true },
  });
  // Agrupar por d\u00eda
  const byDay: Record<string, number> = {};
  for (const i of invoices) {
    const key = i.issueDate.toISOString().slice(0, 10);
    byDay[key] = (byDay[key] ?? 0) + Number(i.total);
  }
  return Object.entries(byDay)
    .map(([day, total]) => ({ day, total }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
