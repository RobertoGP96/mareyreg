import { db } from "@/lib/db";

/**
 * List sales with serialized Decimals so the result is safe to pass directly
 * from a Server Component to a Client Component.
 */
export async function getSales() {
  const rows = await db.pacaSale.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: { include: { classification: true } } },
  });
  return rows.map((s) => ({
    saleId: s.saleId,
    categoryId: s.categoryId,
    clientId: s.clientId,
    quantity: s.quantity,
    salePrice: Number(s.salePrice),
    clientName: s.clientName,
    clientPhone: s.clientPhone,
    paymentMethod: s.paymentMethod,
    saleDate: s.saleDate,
    notes: s.notes,
    createdAt: s.createdAt,
    category: {
      name: s.category.name,
      classification: s.category.classification
        ? { name: s.category.classification.name }
        : null,
    },
  }));
}

export type PacaSaleRow = Awaited<ReturnType<typeof getSales>>[number];

export async function getSalesStats() {
  // totalUnits se agrega en SQL (aggregate). totalRevenue = SUM(quantity*salePrice)
  // no es agregable directamente en Prisma (no hay columna "total" persistida),
  // asi que se reduce en memoria — pero solo trayendo los dos campos necesarios
  // en vez de la fila completa, para acotar el payload consistente con
  // getPacaInventoryStats.
  const [totalsAgg, rows] = await Promise.all([
    db.pacaSale.aggregate({ _sum: { quantity: true } }),
    db.pacaSale.findMany({ select: { quantity: true, salePrice: true } }),
  ]);
  const totalUnits = totalsAgg._sum.quantity ?? 0;
  const totalRevenue = rows.reduce(
    (sum, s) => sum + s.quantity * Number(s.salePrice),
    0
  );
  return { totalSales: totalUnits, totalRevenue };
}
