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
        ruleId: true, name: true, baseCurrencyId: true, quoteCurrencyId: true,
        baseCurrency: { select: { code: true } },
        quoteCurrency: { select: { code: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  return { groups, currencies, rules };
}
