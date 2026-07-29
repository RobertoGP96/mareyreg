import { db } from "@/lib/db";
import type {
  CashDeliveryStatus,
  DeliveryCommissionStatus,
  Prisma,
} from "@/generated/prisma";

export type CashDeliveryLineRow = {
  lineId: number;
  currencyId: number;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimals: number;
  amount: string;
  denominationCount: number;
};

export type CashDeliveryRow = {
  deliveryId: number;
  recipientId: number;
  recipientName: string;
  recipientPhone: string | null;
  recipientAddress: string | null;
  recipientMapUrl: string | null;
  lines: CashDeliveryLineRow[];
  courierId: number | null;
  courierName: string | null;
  commissionAmount: string;
  commissionCurrencyId: number | null;
  commissionCurrencyCode: string | null;
  commissionCurrencySymbol: string | null;
  commissionCurrencyDecimals: number | null;
  commissionStatus: DeliveryCommissionStatus;
  commissionPaidAt: Date | null;
  photoUrl: string | null;
  status: CashDeliveryStatus;
  reference: string | null;
  notes: string | null;
  occurredAt: Date;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdById: number | null;
  confirmedById: number | null;
  version: number;
};

export type ListCashDeliveriesArgs = {
  status?: CashDeliveryStatus;
  recipientId?: number;
  currencyId?: number;
  courierId?: number;
  commissionStatus?: DeliveryCommissionStatus;
  from?: Date;
  to?: Date;
  search?: string;
};

// El desglose completo NO se carga aquí: un include de 3 niveles sobre el
// listado multiplica filas. Solo el detalle (getCashDeliveryById) lo trae.
const LIST_TAKE = 200;

export async function listCashDeliveries(
  args: ListCashDeliveriesArgs = {}
): Promise<CashDeliveryRow[]> {
  const where: Prisma.CashDeliveryWhereInput = {};
  if (args.status) where.status = args.status;
  if (args.recipientId) where.recipientId = args.recipientId;
  if (args.courierId) where.courierId = args.courierId;
  if (args.commissionStatus) where.commissionStatus = args.commissionStatus;
  if (args.currencyId) where.lines = { some: { currencyId: args.currencyId } };
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
      { courier: { user: { fullName: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const rows = await db.cashDelivery.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }, { deliveryId: "desc" }],
    include: {
      recipient: {
        select: { recipientId: true, fullName: true, phone: true, address: true, mapUrl: true },
      },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          currency: {
            select: { currencyId: true, code: true, symbol: true, decimalPlaces: true },
          },
          _count: { select: { denominations: true } },
        },
      },
      courier: { select: { courierProfileId: true, user: { select: { fullName: true } } } },
      commissionCurrency: {
        select: { currencyId: true, code: true, symbol: true, decimalPlaces: true },
      },
    },
    take: LIST_TAKE,
  });

  return rows.map(toDeliveryRow);
}

function toDeliveryRow(r: {
  deliveryId: number;
  recipient: {
    recipientId: number;
    fullName: string;
    phone: string | null;
    address: string | null;
    mapUrl: string | null;
  };
  lines: {
    lineId: number;
    amount: Prisma.Decimal;
    currency: { currencyId: number; code: string; symbol: string; decimalPlaces: number };
    _count: { denominations: number };
  }[];
  courier: { courierProfileId: number; user: { fullName: string } } | null;
  commissionAmount: Prisma.Decimal;
  commissionCurrency: {
    currencyId: number;
    code: string;
    symbol: string;
    decimalPlaces: number;
  } | null;
  commissionStatus: DeliveryCommissionStatus;
  commissionPaidAt: Date | null;
  photoUrl: string | null;
  status: CashDeliveryStatus;
  reference: string | null;
  notes: string | null;
  occurredAt: Date;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdById: number | null;
  confirmedById: number | null;
  version: number;
}): CashDeliveryRow {
  return {
    deliveryId: r.deliveryId,
    recipientId: r.recipient.recipientId,
    recipientName: r.recipient.fullName,
    recipientPhone: r.recipient.phone,
    recipientAddress: r.recipient.address,
    recipientMapUrl: r.recipient.mapUrl,
    lines: r.lines.map((l) => ({
      lineId: l.lineId,
      currencyId: l.currency.currencyId,
      currencyCode: l.currency.code,
      currencySymbol: l.currency.symbol,
      currencyDecimals: l.currency.decimalPlaces,
      amount: l.amount.toString(),
      denominationCount: l._count.denominations,
    })),
    courierId: r.courier?.courierProfileId ?? null,
    courierName: r.courier?.user.fullName ?? null,
    commissionAmount: r.commissionAmount.toString(),
    commissionCurrencyId: r.commissionCurrency?.currencyId ?? null,
    commissionCurrencyCode: r.commissionCurrency?.code ?? null,
    commissionCurrencySymbol: r.commissionCurrency?.symbol ?? null,
    commissionCurrencyDecimals: r.commissionCurrency?.decimalPlaces ?? null,
    commissionStatus: r.commissionStatus,
    commissionPaidAt: r.commissionPaidAt,
    photoUrl: r.photoUrl,
    status: r.status,
    reference: r.reference,
    notes: r.notes,
    occurredAt: r.occurredAt,
    deliveredAt: r.deliveredAt,
    cancelledAt: r.cancelledAt,
    createdById: r.createdById,
    confirmedById: r.confirmedById,
    version: r.version,
  };
}

export type CashDeliveryDetailLine = CashDeliveryLineRow & {
  denominations: { denominationId: number; value: string; quantity: number }[];
};

// Omit + re-declare, no intersección: `CashDeliveryRow & { lines: ... }` deja
// `lines` como intersección de arrays y el acceso a `denominations` no resuelve.
export type CashDeliveryDetail = Omit<CashDeliveryRow, "lines"> & {
  lines: CashDeliveryDetailLine[];
};

export async function getCashDeliveryById(id: number): Promise<CashDeliveryDetail | null> {
  const r = await db.cashDelivery.findUnique({
    where: { deliveryId: id },
    include: {
      recipient: {
        select: { recipientId: true, fullName: true, phone: true, address: true, mapUrl: true },
      },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          currency: {
            select: { currencyId: true, code: true, symbol: true, decimalPlaces: true },
          },
          _count: { select: { denominations: true } },
          denominations: {
            orderBy: { denominationId: "asc" },
            select: { denominationId: true, quantity: true, unitValue: true },
          },
        },
      },
      courier: { select: { courierProfileId: true, user: { select: { fullName: true } } } },
      commissionCurrency: {
        select: { currencyId: true, code: true, symbol: true, decimalPlaces: true },
      },
    },
  });
  if (!r) return null;

  const base = toDeliveryRow(r);
  return {
    ...base,
    lines: base.lines.map((line, index) => ({
      ...line,
      denominations: r.lines[index].denominations.map((d) => ({
        denominationId: d.denominationId,
        value: d.unitValue.toString(),
        quantity: d.quantity,
      })),
    })),
  };
}

export type CommissionSummaryRow = {
  courierId: number;
  courierName: string;
  currencyId: number;
  currencyCode: string;
  currencyDecimals: number;
  pendingAmount: string;
  pendingCount: number;
};

/** Comisiones pendientes agrupadas por mensajero y moneda (sin conversión FX). */
export async function getDeliveryCommissionSummary(): Promise<CommissionSummaryRow[]> {
  const grouped = await db.cashDelivery.groupBy({
    by: ["courierId", "commissionCurrencyId"],
    where: {
      commissionStatus: "pending",
      commissionAmount: { gt: 0 },
      courierId: { not: null },
      status: { not: "cancelled" },
    },
    _sum: { commissionAmount: true },
    _count: { _all: true },
  });
  if (grouped.length === 0) return [];

  const courierIds = [...new Set(grouped.map((g) => g.courierId!))];
  const currencyIds = [...new Set(grouped.map((g) => g.commissionCurrencyId!).filter(Boolean))];

  const [couriers, currencies] = await Promise.all([
    db.courierProfile.findMany({
      where: { courierProfileId: { in: courierIds } },
      select: { courierProfileId: true, user: { select: { fullName: true } } },
    }),
    db.currency.findMany({
      where: { currencyId: { in: currencyIds } },
      select: { currencyId: true, code: true, decimalPlaces: true },
    }),
  ]);
  const courierById = new Map(couriers.map((c) => [c.courierProfileId, c]));
  const currencyById = new Map(currencies.map((c) => [c.currencyId, c]));

  return grouped.flatMap((g) => {
    const courier = courierById.get(g.courierId!);
    const currency = g.commissionCurrencyId
      ? currencyById.get(g.commissionCurrencyId)
      : undefined;
    if (!courier || !currency) return [];
    return [
      {
        courierId: courier.courierProfileId,
        courierName: courier.user.fullName,
        currencyId: currency.currencyId,
        currencyCode: currency.code,
        currencyDecimals: currency.decimalPlaces,
        pendingAmount: (g._sum.commissionAmount ?? 0).toString(),
        pendingCount: g._count._all,
      },
    ];
  });
}
