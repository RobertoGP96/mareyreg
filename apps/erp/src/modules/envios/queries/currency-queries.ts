import { db } from "@/lib/db";
import type { CurrencyRow } from "../lib/types";

export async function getCurrencies(): Promise<CurrencyRow[]> {
  const rows = await db.currency.findMany({
    orderBy: [{ active: "desc" }, { code: "asc" }],
    include: {
      _count: { select: { accounts: true, rulesAsBase: true, rulesAsQuote: true } },
    },
  });
  return rows.map((r) => ({
    currencyId: r.currencyId,
    code: r.code,
    name: r.name,
    symbol: r.symbol,
    decimalPlaces: r.decimalPlaces,
    active: r.active,
    accountsCount: r._count.accounts,
    rulesCount: r._count.rulesAsBase + r._count.rulesAsQuote,
  }));
}

export async function getActiveCurrencies(): Promise<CurrencyRow[]> {
  const all = await getCurrencies();
  return all.filter((c) => c.active);
}

export async function getCurrencyById(id: number) {
  return db.currency.findUnique({ where: { currencyId: id } });
}
