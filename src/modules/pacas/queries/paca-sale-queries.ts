import { db } from "@/lib/db";

export async function getSales() {
  return db.pacaSale.findMany({
    orderBy: { createdAt: "desc" },
    include: { paca: { include: { category: true } } },
  });
}

export async function getSalesStats() {
  const sales = await db.pacaSale.findMany();
  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.salePrice), 0);
  return { totalSales: sales.length, totalRevenue };
}
