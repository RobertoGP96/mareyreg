import { db } from "@/lib/db";

export async function getProducts(includeInactive = false) {
  return db.product.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function getProduct(id: number) {
  return db.product.findUnique({ where: { productId: id } });
}

export async function getProductPriceHistory(productId: number) {
  return db.productPriceHistory.findMany({
    where: { productId },
    include: { changedByUser: { select: { fullName: true } } },
    orderBy: { changedAt: "desc" },
  });
}
