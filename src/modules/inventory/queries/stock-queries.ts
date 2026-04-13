import { db } from "@/lib/db";

export async function getStockMovements() {
  return db.stockMovement.findMany({
    orderBy: { createdAt: "desc" },
    include: { product: true, warehouse: true },
    take: 100,
  });
}

export async function getStockLevels() {
  return db.stockLevel.findMany({
    include: { product: true, warehouse: true },
    orderBy: { product: { name: "asc" } },
  });
}

export async function getLowStockAlerts() {
  const levels = await db.stockLevel.findMany({
    include: { product: true, warehouse: true },
  });
  return levels.filter(
    (l) => Number(l.currentQuantity) < Number(l.product.minStock)
  );
}
