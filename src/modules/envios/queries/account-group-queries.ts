import { db } from "@/lib/db";
import type { AccountGroupRow } from "../lib/types";

export async function getAccountGroups(): Promise<AccountGroupRow[]> {
  const rows = await db.accountGroup.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      user: { select: { fullName: true, email: true } },
      accounts: {
        where: { active: true },
        select: {
          balance: true,
          currency: {
            select: { currencyId: true, code: true, symbol: true, decimalPlaces: true },
          },
        },
      },
      _count: { select: { accounts: true } },
    },
  });

  return rows.map((g) => {
    const map = new Map<
      number,
      { currencyId: number; code: string; symbol: string; decimalPlaces: number; balance: number }
    >();
    for (const a of g.accounts) {
      const c = a.currency;
      const prev = map.get(c.currencyId);
      const amount = Number(a.balance);
      if (prev) {
        prev.balance += amount;
      } else {
        map.set(c.currencyId, {
          currencyId: c.currencyId,
          code: c.code,
          symbol: c.symbol,
          decimalPlaces: c.decimalPlaces,
          balance: amount,
        });
      }
    }
    return {
      groupId: g.groupId,
      code: g.code,
      name: g.name,
      description: g.description,
      active: g.active,
      ownerName: g.user.fullName,
      ownerEmail: g.user.email,
      accountsCount: g._count.accounts,
      balancesByCurrency: Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code)),
    };
  });
}

export async function getAccountGroupById(id: number) {
  return db.accountGroup.findUnique({ where: { groupId: id } });
}

export async function getGroupDetail(id: number) {
  const group = await db.accountGroup.findUnique({
    where: { groupId: id },
    include: {
      user: { select: { fullName: true, email: true } },
      accounts: {
        orderBy: [{ active: "desc" }, { accountNumber: "asc" }],
        include: {
          currency: { select: { currencyId: true, code: true, symbol: true, decimalPlaces: true } },
          rateRules: {
            include: {
              rule: {
                select: {
                  ruleId: true,
                  name: true,
                  active: true,
                  baseCurrencyId: true,
                  quoteCurrencyId: true,
                  baseCurrency: { select: { code: true } },
                  quoteCurrency: { select: { code: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!group) return null;

  const totals = new Map<
    number,
    { currencyId: number; code: string; symbol: string; decimalPlaces: number; balance: number; accounts: number }
  >();
  for (const a of group.accounts) {
    if (!a.active) continue;
    const c = a.currency;
    const prev = totals.get(c.currencyId);
    const amount = Number(a.balance);
    if (prev) {
      prev.balance += amount;
      prev.accounts += 1;
    } else {
      totals.set(c.currencyId, {
        currencyId: c.currencyId,
        code: c.code,
        symbol: c.symbol,
        decimalPlaces: c.decimalPlaces,
        balance: amount,
        accounts: 1,
      });
    }
  }

  const ruleMap = new Map<number, { ruleId: number; name: string; baseCurrencyCode: string; quoteCurrencyCode: string; accountsUsing: number }>();
  for (const a of group.accounts) {
    for (const link of a.rateRules) {
      const r = link.rule;
      if (!r.active) continue;
      const prev = ruleMap.get(r.ruleId);
      if (prev) prev.accountsUsing += 1;
      else
        ruleMap.set(r.ruleId, {
          ruleId: r.ruleId,
          name: r.name,
          baseCurrencyCode: r.baseCurrency.code,
          quoteCurrencyCode: r.quoteCurrency.code,
          accountsUsing: 1,
        });
    }
  }

  return {
    groupId: group.groupId,
    code: group.code,
    name: group.name,
    description: group.description,
    active: group.active,
    ownerName: group.user.fullName,
    ownerEmail: group.user.email,
    accounts: group.accounts.map((a) => ({
      accountId: a.accountId,
      accountNumber: a.accountNumber,
      name: a.name,
      active: a.active,
      allowNegativeBalance: a.allowNegativeBalance,
      balance: Number(a.balance),
      currencyId: a.currencyId,
      currencyCode: a.currency.code,
      currencySymbol: a.currency.symbol,
      currencyDecimals: a.currency.decimalPlaces,
      rulesCount: a.rateRules.filter((l) => l.rule.active).length,
      ruleNames: a.rateRules
        .filter((l) => l.rule.active)
        .map((l) => l.rule.name),
    })),
    balancesByCurrency: Array.from(totals.values()).sort((a, b) => a.code.localeCompare(b.code)),
    rulesUsed: Array.from(ruleMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export type GroupDetail = NonNullable<Awaited<ReturnType<typeof getGroupDetail>>>;

export async function getAssignableUsers() {
  const users = await db.user.findMany({
    select: { userId: true, fullName: true, email: true, role: true },
    orderBy: { fullName: "asc" },
  });
  return users;
}
