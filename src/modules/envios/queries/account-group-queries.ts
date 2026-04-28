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

export async function getAssignableUsers() {
  const users = await db.user.findMany({
    select: { userId: true, fullName: true, email: true, role: true },
    orderBy: { fullName: "asc" },
  });
  return users;
}
