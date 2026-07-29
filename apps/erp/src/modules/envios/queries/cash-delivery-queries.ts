import { db } from "@/lib/db";
import type { CashDeliveryStatus, Prisma } from "@/generated/prisma";

export type CashDeliveryRow = {
  deliveryId: number;
  recipientId: number;
  recipientName: string;
  recipientPhone: string | null;
  recipientAddress: string | null;
  recipientMapUrl: string | null;
  currencyId: number;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimals: number;
  amount: string;
  status: CashDeliveryStatus;
  reference: string | null;
  notes: string | null;
  occurredAt: Date;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdById: number | null;
  confirmedById: number | null;
};

export type ListCashDeliveriesArgs = {
  status?: CashDeliveryStatus;
  recipientId?: number;
  currencyId?: number;
  from?: Date;
  to?: Date;
  search?: string;
};

export async function listCashDeliveries(
  args: ListCashDeliveriesArgs = {}
): Promise<CashDeliveryRow[]> {
  const where: Prisma.CashDeliveryWhereInput = {};
  if (args.status) where.status = args.status;
  if (args.recipientId) where.recipientId = args.recipientId;
  if (args.currencyId) where.currencyId = args.currencyId;
  if (args.from || args.to) {
    where.occurredAt = {
      ...(args.from && { gte: args.from }),
      ...(args.to && { lte: args.to }),
    };
  }
  if (args.search && args.search.trim().length > 0) {
    const q = args.search.trim();
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { recipient: { fullName: { contains: q, mode: "insensitive" } } },
    ];
  }

  const rows = await db.cashDelivery.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }, { deliveryId: "desc" }],
    include: {
      recipient: {
        select: { recipientId: true, fullName: true, phone: true, address: true, mapUrl: true },
      },
      currency: {
        select: { currencyId: true, code: true, symbol: true, decimalPlaces: true },
      },
    },
    take: 500,
  });

  return rows.map((r) => ({
    deliveryId: r.deliveryId,
    recipientId: r.recipient.recipientId,
    recipientName: r.recipient.fullName,
    recipientPhone: r.recipient.phone,
    recipientAddress: r.recipient.address,
    recipientMapUrl: r.recipient.mapUrl,
    currencyId: r.currency.currencyId,
    currencyCode: r.currency.code,
    currencySymbol: r.currency.symbol,
    currencyDecimals: r.currency.decimalPlaces,
    amount: r.amount.toString(),
    status: r.status,
    reference: r.reference,
    notes: r.notes,
    occurredAt: r.occurredAt,
    deliveredAt: r.deliveredAt,
    cancelledAt: r.cancelledAt,
    createdById: r.createdById,
    confirmedById: r.confirmedById,
  }));
}

export async function getCashDeliveryById(id: number) {
  return db.cashDelivery.findUnique({
    where: { deliveryId: id },
    include: { recipient: true, currency: true },
  });
}
