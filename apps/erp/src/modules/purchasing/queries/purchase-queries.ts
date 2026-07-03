import { db } from "@/lib/db";

export async function getPurchaseOrders(filter?: { status?: string }) {
  return db.purchaseOrder.findMany({
    where: filter?.status ? { status: filter.status as "draft" | "sent" | "partial" | "received" | "cancelled" } : undefined,
    include: {
      supplier: { select: { name: true, taxId: true } },
      warehouse: { select: { name: true } },
      currency: { select: { code: true, symbol: true, decimalPlaces: true } },
      _count: { select: { lines: true, receipts: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPurchaseOrder(poId: number) {
  return db.purchaseOrder.findUnique({
    where: { poId },
    include: {
      supplier: true,
      warehouse: true,
      currency: true,
      lines: { include: { product: true, presentation: true } },
      receipts: {
        include: {
          currency: { select: { code: true, symbol: true } },
          lines: {
            include: { lot: true, presentation: true, poLine: { include: { product: true } } },
          },
        },
        orderBy: { receivedAt: "desc" },
      },
    },
  });
}

export async function getOpenPurchaseOrdersForSupplier(supplierId: number) {
  return db.purchaseOrder.findMany({
    where: {
      supplierId,
      status: { in: ["sent", "partial"] },
    },
    include: { lines: { include: { product: true } } },
  });
}
