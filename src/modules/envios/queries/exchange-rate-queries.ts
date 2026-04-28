import { db } from "@/lib/db";
import type { ExchangeRateRuleRow } from "../lib/types";

export async function getExchangeRateRules(): Promise<ExchangeRateRuleRow[]> {
  const rows = await db.exchangeRateRule.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      baseCurrency: { select: { code: true } },
      quoteCurrency: { select: { code: true } },
      ranges: { orderBy: { minAmount: "asc" } },
    },
  });
  return rows.map((r) => ({
    ruleId: r.ruleId,
    name: r.name,
    kind: r.kind,
    baseCurrencyId: r.baseCurrencyId,
    quoteCurrencyId: r.quoteCurrencyId,
    active: r.active,
    baseCurrencyCode: r.baseCurrency.code,
    quoteCurrencyCode: r.quoteCurrency.code,
    ranges: r.ranges.map((rg) => ({
      rangeId: rg.rangeId,
      minAmount: Number(rg.minAmount),
      maxAmount: rg.maxAmount === null ? null : Number(rg.maxAmount),
      rate: Number(rg.rate),
    })),
  }));
}

export async function getRateRuleFormData() {
  return db.currency.findMany({
    where: { active: true },
    select: { currencyId: true, code: true, symbol: true },
    orderBy: { code: "asc" },
  });
}
