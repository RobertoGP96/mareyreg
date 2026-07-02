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

export async function getStockAlerts() {
  const levels = await db.stockLevel.findMany({
    include: { product: true, warehouse: true },
  });
  return levels.filter((l) => {
    const qty = Number(l.currentQuantity);
    const min = Number(l.product.minStock);
    const max = l.product.maxStock ? Number(l.product.maxStock) : null;
    return qty < min || (max !== null && qty > max);
  });
}
