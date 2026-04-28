import { db } from "@/lib/db";
import { getOperations } from "./operation-queries";
import type { OperationRow } from "../lib/types";

export async function getPendingOperations(): Promise<OperationRow[]> {
  return getOperations({ status: "pending", limit: 500 });
}

export async function getPendingSummary() {
  const groups = await db.operation.groupBy({
    by: ["currencyId", "type"],
    where: { status: "pending" },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const currencies = await db.currency.findMany({
    where: { currencyId: { in: groups.map((g) => g.currencyId) } },
    select: { currencyId: true, code: true, decimalPlaces: true },
  });
  const cMap = new Map(currencies.map((c) => [c.currencyId, c]));
  return groups.map((g) => ({
    currencyId: g.currencyId,
    code: cMap.get(g.currencyId)?.code ?? "?",
    decimalPlaces: cMap.get(g.currencyId)?.decimalPlaces ?? 2,
    type: g.type,
    count: g._count._all,
    total: Number(g._sum.amount ?? 0),
  }));
}
