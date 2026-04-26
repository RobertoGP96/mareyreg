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
  const sales = await db.pacaSale.findMany();
  const totalUnits = sales.reduce((sum, s) => sum + s.quantity, 0);
  const totalRevenue = sales.reduce(
    (sum, s) => sum + s.quantity * Number(s.salePrice),
    0
  );
  return { totalSales: totalUnits, totalRevenue };
}
