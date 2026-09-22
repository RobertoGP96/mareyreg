import { db } from "@/lib/db";
import type {
  CashDeliveryStatus,
  DeliveryCommissionStatus,
  DeliveryPhotoKind,
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

export type CashDeliveryPhotoRow = {
  photoId: number;
  url: string;
  kind: DeliveryPhotoKind;
  caption: string | null;
  sortOrder: number;
  uploadedById: number | null;
  uploadedByName: string | null;
  createdAt: Date;
};

export type CashDeliveryRow = {
  deliveryId: number;
  recipientId: number;
  recipientName: string;
  recipientPhone: string | null;
  recipientAddress: string | null;
  recipientMapUrl: string | null;
  providerId: number | null;
  providerName: string | null;
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
  photosCount: number;
  coverPhotoUrl: string | null;
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
  providerId?: number;
  currencyId?: number;
  courierId?: number;
  commissionStatus?: DeliveryCommissionStatus;
  from?: Date;
  to?: Date;
  search?: string;
};

// El desglose y la galería completos NO se cargan aquí: un include de 3
// niveles sobre el listado multiplica filas. Solo el detalle los trae.
const LIST_TAKE = 200;

const RECIPIENT_SELECT = {
  select: { recipientId: true, fullName: true, phone: true, address: true, mapUrl: true },
} as const;

const PROVIDER_SELECT = {
  select: { providerId: true, name: true },
} as const;

const CURRENCY_SELECT = {
  select: { currencyId: true, code: true, symbol: true, decimalPlaces: true },
} as const;

export async function listCashDeliveries(
  args: ListCashDeliveriesArgs = {}
): Promise<CashDeliveryRow[]> {
  const where: Prisma.CashDeliveryWhereInput = {};
  if (args.status) where.status = args.status;
  if (args.recipientId) where.recipientId = args.recipientId;
  if (args.providerId) where.providerId = args.providerId;
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
      { provider: { name: { contains: q, mode: "insensitive" } } },
      { courier: { user: { fullName: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const rows = await db.cashDelivery.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }, { deliveryId: "desc" }],
    include: {
      recipient: RECIPIENT_SELECT,
      provider: PROVIDER_SELECT,
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          currency: CURRENCY_SELECT,
          _count: { select: { denominations: true } },
        },
      },
      photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      _count: { select: { photos: true } },
      courier: { select: { courierProfileId: true, user: { select: { fullName: true } } } },
      commissionCurrency: CURRENCY_SELECT,
    },
    take: LIST_TAKE,
  });

  return rows.map(toDeliveryRow);
}

type DeliveryRowSource = {
  deliveryId: number;
  recipient: {
    recipientId: number;
    fullName: string;
    phone: string | null;
    address: string | null;
    mapUrl: string | null;
  };
  provider: { providerId: number; name: string } | null;
  lines: {
    lineId: number;
    amount: Prisma.Decimal;
    currency: { currencyId: number; code: string; symbol: string; decimalPlaces: number };
    _count: { denominations: number };
  }[];
  photos: { url: string }[];
  _count: { photos: number };
  photoUrl: string | null;
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

// `photoUrl` es el respaldo de las entregas anteriores a la galería: cuenta
// como una foto solo mientras la entrega no tenga filas en cash_delivery_photos.
function legacyPhoto(r: { photos: { url: string }[]; photoUrl: string | null }): string | null {
  if (r.photos.length > 0) return null;
  const trimmed = r.photoUrl?.trim();
  return trimmed ? trimmed : null;
}

function toDeliveryRow(r: DeliveryRowSource): CashDeliveryRow {
  const legacy = legacyPhoto(r);
  return {
    deliveryId: r.deliveryId,
    recipientId: r.recipient.recipientId,
    recipientName: r.recipient.fullName,
    recipientPhone: r.recipient.phone,
    recipientAddress: r.recipient.address,
    recipientMapUrl: r.recipient.mapUrl,
    providerId: r.provider?.providerId ?? null,
    providerName: r.provider?.name ?? null,
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
    photosCount: r._count.photos > 0 ? r._count.photos : legacy ? 1 : 0,
    coverPhotoUrl: r.photos[0]?.url ?? legacy,
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
  photos: CashDeliveryPhotoRow[];
  /** Foto única del modelo anterior; solo si la galería está vacía. */
  legacyPhotoUrl: string | null;
  createdByName: string | null;
  confirmedByName: string | null;
  commissionPaidByName: string | null;
};

export async function getCashDeliveryById(id: number): Promise<CashDeliveryDetail | null> {
  const r = await db.cashDelivery.findUnique({
    where: { deliveryId: id },
    include: {
      recipient: RECIPIENT_SELECT,
      provider: PROVIDER_SELECT,
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          currency: CURRENCY_SELECT,
          _count: { select: { denominations: true } },
          denominations: {
            orderBy: { denominationId: "asc" },
            select: { denominationId: true, quantity: true, unitValue: true },
          },
        },
      },
      photos: {
        orderBy: [{ sortOrder: "asc" }, { photoId: "asc" }],
        include: { uploadedBy: { select: { fullName: true } } },
      },
      _count: { select: { photos: true } },
      courier: { select: { courierProfileId: true, user: { select: { fullName: true } } } },
      commissionCurrency: CURRENCY_SELECT,
      createdBy: { select: { fullName: true } },
      confirmedBy: { select: { fullName: true } },
      commissionPaidBy: { select: { fullName: true } },
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
    photos: r.photos.map((p) => ({
      photoId: p.photoId,
      url: p.url,
      kind: p.kind,
      caption: p.caption,
      sortOrder: p.sortOrder,
      uploadedById: p.uploadedById,
      uploadedByName: p.uploadedBy?.fullName ?? null,
      createdAt: p.createdAt,
    })),
    legacyPhotoUrl: legacyPhoto(r),
    createdByName: r.createdBy?.fullName ?? null,
    confirmedByName: r.confirmedBy?.fullName ?? null,
    commissionPaidByName: r.commissionPaidBy?.fullName ?? null,
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

const PENDING_COMMISSION_WHERE = {
  commissionStatus: "pending",
  commissionAmount: { gt: 0 },
  courierId: { not: null },
  status: { not: "cancelled" },
} satisfies Prisma.CashDeliveryWhereInput;

/** Comisiones pendientes agrupadas por mensajero y moneda (sin conversión FX). */
export async function getDeliveryCommissionSummary(): Promise<CommissionSummaryRow[]> {
  const grouped = await db.cashDelivery.groupBy({
    by: ["courierId", "commissionCurrencyId"],
    where: PENDING_COMMISSION_WHERE,
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

export type PendingCommissionByCurrency = {
  currencyId: number;
  code: string;
  symbol: string;
  decimalPlaces: number;
  total: string;
  count: number;
};

/** Total de comisiones por pagar por moneda, para el KPI del listado. */
export async function getPendingCommissionByCurrency(): Promise<PendingCommissionByCurrency[]> {
  const grouped = await db.cashDelivery.groupBy({
    by: ["commissionCurrencyId"],
    where: PENDING_COMMISSION_WHERE,
    _sum: { commissionAmount: true },
    _count: { _all: true },
  });
  const currencyIds = grouped.map((g) => g.commissionCurrencyId!).filter(Boolean);
  if (currencyIds.length === 0) return [];

  const currencies = await db.currency.findMany({
    where: { currencyId: { in: currencyIds } },
    select: { currencyId: true, code: true, symbol: true, decimalPlaces: true },
  });
  const byId = new Map(currencies.map((c) => [c.currencyId, c]));

  return grouped.flatMap((g) => {
    const currency = g.commissionCurrencyId ? byId.get(g.commissionCurrencyId) : undefined;
    if (!currency) return [];
    return [
      {
        ...currency,
        total: (g._sum.commissionAmount ?? 0).toString(),
        count: g._count._all,
      },
    ];
  });
}
