import { db } from "@/lib/db";

export async function getPurchaseOrders(filter?: { status?: string }) {
  return db.purchaseOrder.findMany({
    where: filter?.status ? { status: filter.status as "draft" | "sent" | "partial" | "received" | "cancelled" } : undefined,
    include: {
      supplier: { select: { name: true, taxId: true } },
      warehouse: { select: { name: true } },
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
      lines: { include: { product: true } },
      receipts: {
        include: { lines: { include: { lot: true, poLine: { include: { product: true } } } } },
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
