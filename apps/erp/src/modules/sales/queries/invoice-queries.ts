import { db } from "@/lib/db";

export async function getInvoices(filter?: { status?: string; channel?: string }) {
  return db.invoice.findMany({
    where: {
      ...(filter?.status && { status: filter.status as "pending" | "partial" | "paid" | "cancelled" }),
      ...(filter?.channel && { channel: filter.channel as "pos" | "b2b" }),
    },
    include: {
      customer: { select: { name: true, taxId: true } },
      _count: { select: { lines: true, payments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getInvoice(invoiceId: number) {
  return db.invoice.findUnique({
    where: { invoiceId },
    include: {
      customer: true,
      lines: { include: { product: true, lot: true } },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
}

export async function getAccountsReceivable() {
  const invoices = await db.invoice.findMany({
    where: { status: { in: ["pending", "partial"] } },
    include: { customer: { select: { name: true } } },
    orderBy: { issueDate: "asc" },
  });
  const now = new Date();
  return invoices.map((inv) => {
    const balance = Number(inv.total) - Number(inv.paid);
    const daysOverdue = inv.dueDate
      ? Math.max(0, Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    const bucket =
      daysOverdue <= 0 ? "current" : daysOverdue <= 30 ? "0-30" : daysOverdue <= 60 ? "31-60" : daysOverdue <= 90 ? "61-90" : "90+";
    return { ...inv, balance, daysOverdue, bucket };
  });
}
