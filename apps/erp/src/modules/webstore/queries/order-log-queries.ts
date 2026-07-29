import { db } from "@/lib/db";

export async function getOrderLogs(status?: string) {
  return db.webstoreOrderLog.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      apiKey: { select: { label: true } },
      salesOrder: { select: { folio: true } },
      invoice: { select: { folio: true, total: true } },
    },
    orderBy: { receivedAt: "desc" },
  });
}

export async function getOrderLogById(logId: number) {
  return db.webstoreOrderLog.findUnique({
    where: { logId },
    include: {
      apiKey: { select: { label: true } },
      salesOrder: {
        select: {
          folio: true,
          orderId: true,
          total: true,
          lines: {
            select: {
              lineId: true,
              productId: true,
              quantity: true,
              unitPrice: true,
              subtotal: true,
              pieces: true,
              baseQuantity: true,
              product: { select: { name: true, isCatchWeight: true } },
              presentation: { select: { name: true } },
            },
          },
        },
      },
      invoice: { select: { folio: true, invoiceId: true, total: true, status: true } },
    },
  });
}

export async function getWebstoreDashboardKpis() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [receivedToday, needsReview, error, processedToday] = await Promise.all([
    db.webstoreOrderLog.count({ where: { receivedAt: { gte: startOfDay } } }),
    db.webstoreOrderLog.count({ where: { status: "needs_review" } }),
    db.webstoreOrderLog.count({ where: { status: "error" } }),
    db.webstoreOrderLog.count({ where: { status: "processed", processedAt: { gte: startOfDay } } }),
  ]);

  return { receivedToday, needsReview, error, processedToday };
}
