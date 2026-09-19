import { db } from "@/lib/db";

export type DenominationRow = {
  denominationId: number;
  currencyId: number;
  value: string;
  label: string | null;
  sortOrder: number;
  active: boolean;
  usageCount: number;
};

export async function listDenominationsByCurrency(
  currencyId: number
): Promise<DenominationRow[]> {
  const rows = await db.currencyDenomination.findMany({
    where: { currencyId },
    orderBy: [{ sortOrder: "asc" }, { value: "desc" }],
    include: { _count: { select: { lineItems: true } } },
  });

  return rows.map((r) => ({
    denominationId: r.denominationId,
    currencyId: r.currencyId,
    value: r.value.toString(),
    label: r.label,
    sortOrder: r.sortOrder,
    active: r.active,
    usageCount: r._count.lineItems,
  }));
}

/** Conteo de denominaciones activas por moneda, para la lista de monedas. */
export async function getDenominationCounts(): Promise<Record<number, number>> {
  const grouped = await db.currencyDenomination.groupBy({
    by: ["currencyId"],
    _count: { _all: true },
  });
  return Object.fromEntries(grouped.map((g) => [g.currencyId, g._count._all]));
}
