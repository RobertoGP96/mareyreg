import { db } from "@/lib/db";
import type { ExchangeRateRuleRow } from "../lib/types";

export async function getExchangeRateRules(): Promise<ExchangeRateRuleRow[]> {
  const rows = await db.exchangeRateRule.findMany({
    orderBy: [
      { active: "desc" },
      { baseCurrencyId: "asc" },
      { quoteCurrencyId: "asc" },
      { minAmount: "asc" },
    ],
    include: {
      baseCurrency: { select: { code: true } },
      quoteCurrency: { select: { code: true } },
      _count: { select: { accounts: true } },
    },
  });
  return rows.map((r) => ({
    ruleId: r.ruleId,
    name: r.name,
    baseCurrencyId: r.baseCurrencyId,
    quoteCurrencyId: r.quoteCurrencyId,
    active: r.active,
    baseCurrencyCode: r.baseCurrency.code,
    quoteCurrencyCode: r.quoteCurrency.code,
    minAmount: Number(r.minAmount),
    maxAmount: r.maxAmount === null ? null : Number(r.maxAmount),
    minInclusive: r.minInclusive,
    maxInclusive: r.maxInclusive,
    rate: Number(r.rate),
    accountsCount: r._count.accounts,
  }));
}

export async function getRateRuleFormData() {
  return db.currency.findMany({
    where: { active: true },
    select: { currencyId: true, code: true, symbol: true },
    orderBy: { code: "asc" },
  });
}
