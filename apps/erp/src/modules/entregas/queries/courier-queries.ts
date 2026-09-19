import { db } from "@/lib/db";

export type CourierRow = {
  courierProfileId: number;
  userId: number;
  fullName: string;
  email: string;
  phone: string | null;
  notes: string | null;
  defaultCommission: string | null;
  defaultCommissionCurrencyId: number | null;
  defaultCommissionCurrencyCode: string | null;
  defaultCommissionCurrencyDecimals: number | null;
  active: boolean;
  version: number;
  deliveriesCount: number;
};

export async function listCouriers(): Promise<CourierRow[]> {
  const rows = await db.courierProfile.findMany({
    orderBy: [{ active: "desc" }, { courierProfileId: "asc" }],
    include: {
      user: { select: { userId: true, fullName: true, email: true } },
      defaultCommissionCurrency: {
        select: { currencyId: true, code: true, decimalPlaces: true },
      },
      _count: { select: { deliveries: true } },
    },
  });

  return rows.map((r) => ({
    courierProfileId: r.courierProfileId,
    userId: r.user.userId,
    fullName: r.user.fullName,
    email: r.user.email,
    phone: r.phone,
    notes: r.notes,
    defaultCommission: r.defaultCommission?.toString() ?? null,
    defaultCommissionCurrencyId: r.defaultCommissionCurrency?.currencyId ?? null,
    defaultCommissionCurrencyCode: r.defaultCommissionCurrency?.code ?? null,
    defaultCommissionCurrencyDecimals: r.defaultCommissionCurrency?.decimalPlaces ?? null,
    active: r.active,
    version: r.version,
    deliveriesCount: r._count.deliveries,
  }));
}

export type CourierPickerOption = {
  courierProfileId: number;
  fullName: string;
  defaultCommission: string | null;
  defaultCommissionCurrencyId: number | null;
};

/** Mensajeros activos con sus valores por defecto, para pre-llenar el form. */
export async function getCourierPickerOptions(): Promise<CourierPickerOption[]> {
  const rows = await db.courierProfile.findMany({
    where: { active: true },
    orderBy: { user: { fullName: "asc" } },
    select: {
      courierProfileId: true,
      defaultCommission: true,
      defaultCommissionCurrencyId: true,
      user: { select: { fullName: true } },
    },
  });

  return rows.map((r) => ({
    courierProfileId: r.courierProfileId,
    fullName: r.user.fullName,
    defaultCommission: r.defaultCommission?.toString() ?? null,
    defaultCommissionCurrencyId: r.defaultCommissionCurrencyId,
  }));
}

/** Usuarios que aún no tienen perfil de mensajero. */
export async function getAssignableUsersForCourier(): Promise<
  { userId: number; fullName: string; email: string }[]
> {
  return db.user.findMany({
    where: { courierProfile: null },
    orderBy: { fullName: "asc" },
    select: { userId: true, fullName: true, email: true },
  });
}
