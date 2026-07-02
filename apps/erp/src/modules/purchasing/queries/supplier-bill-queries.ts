import { db } from "@/lib/db";
import type { SupplierBillStatus } from "@/generated/prisma";

function toNumber(value: unknown): number {
  return value == null ? 0 : Number(value);
}

export interface SupplierBillListItem {
  billId: number;
  folio: string;
  supplierId: number;
  supplierName: string;
  purchaseOrderId: number | null;
  purchaseOrderFolio: string | null;
  issueDate: string;
  dueDate: string | null;
  total: number;
  paid: number;
  balance: number;
  status: SupplierBillStatus;
  isOverdue: boolean;
}

export async function getSupplierBills(filter?: {
  status?: SupplierBillStatus;
  supplierId?: number;
}): Promise<SupplierBillListItem[]> {
  const rows = await db.supplierBill.findMany({
    where: {
      status: filter?.status,
      supplierId: filter?.supplierId,
    },
    include: {
      supplier: { select: { name: true } },
      purchaseOrder: { select: { folio: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { issueDate: "desc" }],
  });

  const now = new Date();

  return rows.map((b) => {
    const total = toNumber(b.total);
    const paid = toNumber(b.paid);
    const balance = Math.max(total - paid, 0);
    const isOverdue =
      b.status !== "paid" &&
      b.status !== "cancelled" &&
      !!b.dueDate &&
      b.dueDate.getTime() < now.getTime();

    return {
      billId: b.billId,
      folio: b.folio,
      supplierId: b.supplierId,
      supplierName: b.supplier.name,
      purchaseOrderId: b.purchaseOrderId,
      purchaseOrderFolio: b.purchaseOrder?.folio ?? null,
      issueDate: b.issueDate.toISOString(),
      dueDate: b.dueDate ? b.dueDate.toISOString() : null,
      total,
      paid,
      balance,
      status: b.status,
      isOverdue,
    };
  });
}

export interface SupplierBillDetail extends SupplierBillListItem {
  notes: string | null;
  createdAt: string;
  payments: {
    paymentId: number;
    amount: number;
    method: string;
    paymentDate: string;
    notes: string | null;
  }[];
}

export async function getSupplierBill(billId: number): Promise<SupplierBillDetail | null> {
  const b = await db.supplierBill.findUnique({
    where: { billId },
    include: {
      supplier: { select: { name: true } },
      purchaseOrder: { select: { folio: true } },
      payments: { orderBy: { paymentDate: "desc" } },
    },
  });
  if (!b) return null;

  const total = toNumber(b.total);
  const paid = toNumber(b.paid);
  const balance = Math.max(total - paid, 0);
  const now = new Date();
  const isOverdue =
    b.status !== "paid" &&
    b.status !== "cancelled" &&
    !!b.dueDate &&
    b.dueDate.getTime() < now.getTime();

  return {
    billId: b.billId,
    folio: b.folio,
    supplierId: b.supplierId,
    supplierName: b.supplier.name,
    purchaseOrderId: b.purchaseOrderId,
    purchaseOrderFolio: b.purchaseOrder?.folio ?? null,
    issueDate: b.issueDate.toISOString(),
    dueDate: b.dueDate ? b.dueDate.toISOString() : null,
    total,
    paid,
    balance,
    status: b.status,
    isOverdue,
    notes: b.notes,
    createdAt: b.createdAt.toISOString(),
    payments: b.payments.map((p) => ({
      paymentId: p.paymentId,
      amount: toNumber(p.amount),
      method: p.method,
      paymentDate: p.paymentDate.toISOString(),
      notes: p.notes,
    })),
  };
}

export interface AccountsPayableSummary {
  totalOwed: number;
  totalOverdue: number;
  totalPaidThisMonth: number;
  openCount: number;
  overdueCount: number;
}

export async function getAccountsPayableSummary(): Promise<AccountsPayableSummary> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [openBills, paymentsThisMonth] = await Promise.all([
    db.supplierBill.findMany({
      where: { status: { in: ["open", "partial"] } },
      select: { total: true, paid: true, dueDate: true },
    }),
    db.supplierPayment.findMany({
      where: { paymentDate: { gte: monthStart } },
      select: { amount: true },
    }),
  ]);

  let totalOwed = 0;
  let totalOverdue = 0;
  let overdueCount = 0;

  for (const b of openBills) {
    const balance = Math.max(toNumber(b.total) - toNumber(b.paid), 0);
    totalOwed += balance;
    if (b.dueDate && b.dueDate.getTime() < now.getTime()) {
      totalOverdue += balance;
      overdueCount += 1;
    }
  }

  const totalPaidThisMonth = paymentsThisMonth.reduce((s, p) => s + toNumber(p.amount), 0);

  return {
    totalOwed,
    totalOverdue,
    totalPaidThisMonth,
    openCount: openBills.length,
    overdueCount,
  };
}

export interface SupplierPayableAging {
  supplierId: number;
  supplierName: string;
  current: number;
  overdue: number;
  total: number;
}

export async function getPayablesBySupplier(): Promise<SupplierPayableAging[]> {
  const bills = await db.supplierBill.findMany({
    where: { status: { in: ["open", "partial"] } },
    include: { supplier: { select: { name: true } } },
  });

  const now = new Date();
  const bySupplier = new Map<number, SupplierPayableAging>();

  for (const b of bills) {
    const balance = Math.max(toNumber(b.total) - toNumber(b.paid), 0);
    const isOverdue = !!b.dueDate && b.dueDate.getTime() < now.getTime();
    const entry = bySupplier.get(b.supplierId) ?? {
      supplierId: b.supplierId,
      supplierName: b.supplier.name,
      current: 0,
      overdue: 0,
      total: 0,
    };
    if (isOverdue) entry.overdue += balance;
    else entry.current += balance;
    entry.total += balance;
    bySupplier.set(b.supplierId, entry);
  }

  return Array.from(bySupplier.values()).sort((a, b) => b.total - a.total);
}

export async function getReceivedPurchaseOrdersWithoutBill() {
  const pos = await db.purchaseOrder.findMany({
    where: {
      status: { in: ["received", "partial"] },
    },
    include: {
      supplier: { select: { name: true } },
      bills: { select: { billId: true } },
    },
    orderBy: { orderDate: "desc" },
  });

  return pos
    .filter((po) => po.bills.length === 0)
    .map((po) => ({
      poId: po.poId,
      folio: po.folio,
      supplierId: po.supplierId,
      supplierName: po.supplier.name,
      orderDate: po.orderDate.toISOString(),
      total: toNumber(po.total),
    }));
}
