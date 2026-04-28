import { db } from "@/lib/db";
import type { AccountRow } from "../lib/types";

export async function getAccounts(): Promise<AccountRow[]> {
  const rows = await db.account.findMany({
    orderBy: [{ active: "desc" }, { accountNumber: "asc" }],
    include: {
      group: { select: { name: true, code: true } },
      currency: { select: { code: true, symbol: true, decimalPlaces: true } },
      exchangeRateRule: { select: { ruleId: true, name: true } },
    },
  });
  return rows.map((a) => ({
    accountId: a.accountId,
    groupId: a.groupId,
    userId: a.userId,
    currencyId: a.currencyId,
    accountNumber: a.accountNumber,
    name: a.name,
    active: a.active,
    allowNegativeBalance: a.allowNegativeBalance,
    balance: Number(a.balance),
    groupName: a.group.name,
    groupCode: a.group.code,
    currencyCode: a.currency.code,
    currencySymbol: a.currency.symbol,
    currencyDecimals: a.currency.decimalPlaces,
    ruleId: a.exchangeRateRule?.ruleId ?? null,
    ruleName: a.exchangeRateRule?.name ?? null,
  }));
}

export async function getAccountById(id: number) {
  return db.account.findUnique({
    where: { accountId: id },
    include: {
      group: true,
      currency: true,
      exchangeRateRule: { include: { ranges: { orderBy: { minAmount: "asc" } } } },
    },
  });
}

export async function getAccountDetail(id: number) {
  const account = await db.account.findUnique({
    where: { accountId: id },
    include: {
      group: { select: { groupId: true, code: true, name: true } },
      currency: { select: { currencyId: true, code: true, symbol: true, decimalPlaces: true } },
      exchangeRateRule: {
        include: {
          baseCurrency: { select: { code: true } },
          quoteCurrency: { select: { code: true } },
          ranges: { orderBy: { minAmount: "asc" } },
        },
      },
    },
  });
  if (!account) return null;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [inflows, outflows, pending] = await Promise.all([
    db.operation.aggregate({
      where: {
        accountId: id,
        status: "confirmed",
        type: { in: ["deposit", "transfer_in"] },
        occurredAt: { gte: since },
      },
      _sum: { amount: true },
    }),
    db.operation.aggregate({
      where: {
        accountId: id,
        status: "confirmed",
        type: { in: ["withdrawal", "transfer_out"] },
        occurredAt: { gte: since },
      },
      _sum: { amount: true },
    }),
    db.operation.count({ where: { accountId: id, status: "pending" } }),
  ]);

  return {
    accountId: account.accountId,
    groupId: account.groupId,
    groupCode: account.group.code,
    groupName: account.group.name,
    currencyId: account.currencyId,
    currencyCode: account.currency.code,
    currencySymbol: account.currency.symbol,
    currencyDecimals: account.currency.decimalPlaces,
    accountNumber: account.accountNumber,
    name: account.name,
    active: account.active,
    allowNegativeBalance: account.allowNegativeBalance,
    balance: Number(account.balance),
    rule: account.exchangeRateRule
      ? {
          ruleId: account.exchangeRateRule.ruleId,
          name: account.exchangeRateRule.name,
          kind: account.exchangeRateRule.kind,
          active: account.exchangeRateRule.active,
          baseCurrencyId: account.exchangeRateRule.baseCurrencyId,
          quoteCurrencyId: account.exchangeRateRule.quoteCurrencyId,
          baseCurrencyCode: account.exchangeRateRule.baseCurrency.code,
          quoteCurrencyCode: account.exchangeRateRule.quoteCurrency.code,
          ranges: account.exchangeRateRule.ranges.map((rg) => ({
            rangeId: rg.rangeId,
            minAmount: Number(rg.minAmount),
            maxAmount: rg.maxAmount === null ? null : Number(rg.maxAmount),
            rate: Number(rg.rate),
          })),
        }
      : null,
    kpis: {
      balance: Number(account.balance),
      inflows30d: Number(inflows._sum.amount ?? 0),
      outflows30d: Number(outflows._sum.amount ?? 0),
      pending,
    },
  };
}

export type AccountDetail = NonNullable<Awaited<ReturnType<typeof getAccountDetail>>>;

export async function getAccountFormData() {
  const [groups, currencies, rules] = await Promise.all([
    db.accountGroup.findMany({
      where: { active: true },
      select: { groupId: true, code: true, name: true, userId: true },
      orderBy: { name: "asc" },
    }),
    db.currency.findMany({
      where: { active: true },
      select: { currencyId: true, code: true, symbol: true, decimalPlaces: true },
      orderBy: { code: "asc" },
    }),
    db.exchangeRateRule.findMany({
      where: { active: true },
      select: {
        ruleId: true, name: true, kind: true, active: true,
        baseCurrencyId: true, quoteCurrencyId: true,
        baseCurrency: { select: { code: true } },
        quoteCurrency: { select: { code: true } },
        ranges: {
          orderBy: { minAmount: "asc" },
          select: { rangeId: true, minAmount: true, maxAmount: true, rate: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const rulesSerialized = rules.map((r) => ({
    ruleId: r.ruleId,
    name: r.name,
    kind: r.kind,
    active: r.active,
    baseCurrencyId: r.baseCurrencyId,
    quoteCurrencyId: r.quoteCurrencyId,
    baseCurrency: r.baseCurrency,
    quoteCurrency: r.quoteCurrency,
    baseCurrencyCode: r.baseCurrency.code,
    quoteCurrencyCode: r.quoteCurrency.code,
    ranges: r.ranges.map((rg) => ({
      rangeId: rg.rangeId,
      minAmount: Number(rg.minAmount),
      maxAmount: rg.maxAmount === null ? null : Number(rg.maxAmount),
      rate: Number(rg.rate),
    })),
  }));
  return { groups, currencies, rules: rulesSerialized };
}
