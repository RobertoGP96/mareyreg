import { db } from "@/lib/db";

export async function getDiscounts() {
  return db.discount.findMany({
    include: {
      product: { select: { name: true, sku: true } },
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
