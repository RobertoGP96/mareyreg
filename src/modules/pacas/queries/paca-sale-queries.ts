import { db } from "@/lib/db";

export async function getSales() {
  return db.pacaSale.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: { include: { classification: true } } },
  });
}

export async function getSalesStats() {
  const sales = await db.pacaSale.findMany();
  const totalUnits = sales.reduce((sum, s) => sum + s.quantity, 0);
  const totalRevenue = sales.reduce((sum, s) => sum + s.quantity * Number(s.salePrice), 0);
  return { totalSales: totalUnits, totalRevenue };
}
