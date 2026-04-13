import { db } from "@/lib/db";

export async function getProducts() {
  return db.product.findMany({ orderBy: { name: "asc" } });
}

export async function getProduct(id: number) {
  return db.product.findUnique({ where: { productId: id } });
}
