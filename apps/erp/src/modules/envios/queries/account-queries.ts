import { db } from "@/lib/db";
import type { AccountRow } from "../lib/types";

export async function getAccounts(): Promise<AccountRow[]> {
  const rows = await db.account.findMany({
    orderBy: [{ active: "desc" }, { accountNumber: "asc" }],
    include: {
      group: { select: { name: true, code: true } },
      currency: { select: { code: true, symbol: true, decimalPlaces: true } },
      rateRules: {
        include: { rule: { select: { ruleId: true, name: true, active: true } } },
      },
    },
  });
  return rows.map((a) => {
    const activeRules = a.rateRules.filter((l) => l.rule.active);
    return {
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
      rulesCount: activeRules.length,
      ruleNames: activeRules.map((l) => l.rule.name),
    };
  });
}

export async function getAccountById(id: number) {
  return db.account.findUnique({
    where: { accountId: id },
    include: {
      group: true,
      currency: true,
      rateRules: {
        include: {
          rule: {
            include: {
              baseCurrency: { select: { code: true } },
              quoteCurrency: { select: { code: true } },
            },
          },
        },
      },
    },
  });
}

export async function getAccountDetail(id: number) {
  const account = await db.account.findUnique({
    where: { accountId: id },
    include: {
      group: { select: { groupId: true, code: true, name: true } },
      currency: { select: { currencyId: true, code: true, symbol: true, decimalPlaces: true } },
      rateRules: {
        include: {
          rule: {
            include: {
              baseCurrency: { select: { code: true } },
              quoteCurrency: { select: { code: true } },
            },
          },
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

  const rules = account.rateRules
    .map((l) => l.rule)
    .sort((a, b) => Number(a.minAmount) - Number(b.minAmount))
    .map((rule) => ({
      ruleId: rule.ruleId,
      name: rule.name,
      active: rule.active,
      baseCurrencyId: rule.baseCurrencyId,
      quoteCurrencyId: rule.quoteCurrencyId,
      baseCurrencyCode: rule.baseCurrency.code,
      quoteCurrencyCode: rule.quoteCurrency.code,
      minAmount: Number(rule.minAmount),
      maxAmount: rule.maxAmount === null ? null : Number(rule.maxAmount),
      minInclusive: rule.minInclusive,
      maxInclusive: rule.maxInclusive,
      rate: Number(rule.rate),
    }));

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
    rules,
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
        ruleId: true,
        name: true,
        active: true,
        baseCurrencyId: true,
        quoteCurrencyId: true,
        minAmount: true,
        maxAmount: true,
        minInclusive: true,
        maxInclusive: true,
        rate: true,
        baseCurrency: { select: { code: true } },
        quoteCurrency: { select: { code: true } },
      },
      orderBy: [{ baseCurrencyId: "asc" }, { quoteCurrencyId: "asc" }, { minAmount: "asc" }],
    }),
  ]);
  const rulesSerialized = rules.map((r) => ({
    ruleId: r.ruleId,
    name: r.name,
    active: r.active,
    baseCurrencyId: r.baseCurrencyId,
    quoteCurrencyId: r.quoteCurrencyId,
    baseCurrency: r.baseCurrency,
    quoteCurrency: r.quoteCurrency,
    baseCurrencyCode: r.baseCurrency.code,
    quoteCurrencyCode: r.quoteCurrency.code,
    minAmount: Number(r.minAmount),
    maxAmount: r.maxAmount === null ? null : Number(r.maxAmount),
    minInclusive: r.minInclusive,
    maxInclusive: r.maxInclusive,
    rate: Number(r.rate),
  }));
  return { groups, currencies, rules: rulesSerialized };
}
