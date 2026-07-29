import { db } from "@/lib/db";
import type { ExchangeRateRow, ExchangeRateHistoryRow, CurrencyOption } from "../lib/types";

export { getActiveCurrencies } from "@/modules/envios/queries/currency-queries";

export async function getCurrentRates(): Promise<ExchangeRateRow[]> {
  const rows = await db.exchangeRate.findMany({
    include: { baseCurrency: true, quoteCurrency: true },
    orderBy: [{ baseCurrency: { code: "asc" } }, { quoteCurrency: { code: "asc" } }],
  });

  const updaterIds = [...new Set(rows.map((r) => r.updatedBy).filter((id): id is number => id != null))];
  const updaters = updaterIds.length
    ? await db.user.findMany({ where: { userId: { in: updaterIds } }, select: { userId: true, fullName: true } })
    : [];
  const updaterNameById = new Map(updaters.map((u) => [u.userId, u.fullName]));

  return rows.map((r) => ({
    exchangeRateId: r.exchangeRateId,
    baseCurrencyId: r.baseCurrencyId,
    quoteCurrencyId: r.quoteCurrencyId,
    baseCurrencyCode: r.baseCurrency.code,
    baseCurrencySymbol: r.baseCurrency.symbol,
    quoteCurrencyCode: r.quoteCurrency.code,
    quoteCurrencySymbol: r.quoteCurrency.symbol,
    quoteDecimalPlaces: r.quoteCurrency.decimalPlaces,
    rate: r.rate.toNumber(),
    version: r.version,
    updatedBy: r.updatedBy,
    updatedByName: r.updatedBy != null ? updaterNameById.get(r.updatedBy) ?? null : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getRateHistory(exchangeRateId: number, limit = 50): Promise<ExchangeRateHistoryRow[]> {
  const rows = await db.exchangeRateHistory.findMany({
    where: { exchangeRateId },
    orderBy: { changedAt: "desc" },
    take: limit,
  });

  const changerIds = [...new Set(rows.map((r) => r.changedBy).filter((id): id is number => id != null))];
  const changers = changerIds.length
    ? await db.user.findMany({ where: { userId: { in: changerIds } }, select: { userId: true, fullName: true } })
    : [];
  const changerNameById = new Map(changers.map((u) => [u.userId, u.fullName]));

  return rows.map((r) => ({
    historyId: r.historyId,
    exchangeRateId: r.exchangeRateId,
    oldRate: r.oldRate?.toNumber() ?? null,
    newRate: r.newRate.toNumber(),
    changedBy: r.changedBy,
    changedByName: r.changedBy != null ? changerNameById.get(r.changedBy) ?? null : null,
    changedAt: r.changedAt,
    note: r.note,
  }));
}

export async function getRateFormData(): Promise<{ currencies: CurrencyOption[] }> {
  const currencies = await db.currency.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
    select: { currencyId: true, code: true, name: true, symbol: true, decimalPlaces: true },
  });
  return { currencies };
}
