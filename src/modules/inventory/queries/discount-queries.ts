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

export interface DiscountHistoryRow {
  historyId: number;
  discountId: number | null;
  discountName: string | null;
  productId: number | null;
  action: string;
  oldValues: unknown;
  newValues: unknown;
  changedBy: number | null;
  changedByName: string | null;
  changedAt: string;
}

export async function getDiscountHistory(productId: number): Promise<DiscountHistoryRow[]> {
  const rows = await db.discountHistory.findMany({
    where: { productId },
    include: {
      discount: { select: { name: true } },
      changedByUser: { select: { fullName: true } },
    },
    orderBy: { changedAt: "desc" },
  });

  return rows.map((h) => ({
    historyId: h.historyId,
    discountId: h.discountId,
    discountName: h.discount?.name ?? null,
    productId: h.productId,
    action: String(h.action),
    oldValues: h.oldValues,
    newValues: h.newValues,
    changedBy: h.changedBy,
    changedByName: h.changedByUser?.fullName ?? null,
    changedAt: h.changedAt.toISOString(),
  }));
}
