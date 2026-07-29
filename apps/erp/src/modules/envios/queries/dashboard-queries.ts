import { db } from "@/lib/db";
import { getOperations } from "./operation-queries";

export async function getDashboardData() {
  const [
    currencies,
    accountAggregates,
    pendingCount,
    activeGroupsCount,
    totalAccountsCount,
    todayOpsCount,
    recentOps,
    pendingTop,
    flowLast30,
    pendingCommissions,
  ] = await Promise.all([
    db.currency.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
    }),
    db.account.groupBy({
      by: ["currencyId"],
      where: { active: true },
      _sum: { balance: true },
      _count: { _all: true },
    }),
    db.operation.count({ where: { status: "pending" } }),
    db.accountGroup.count({ where: { active: true } }),
    db.account.count({ where: { active: true } }),
    db.operation.count({
      where: {
        status: "confirmed",
        occurredAt: { gte: startOfToday() },
      },
    }),
    getOperations({ status: "confirmed", limit: 8 }),
    getOperations({ status: "pending", limit: 5 }),
    db.operation.groupBy({
      by: ["currencyId", "type"],
      where: {
        status: "confirmed",
        occurredAt: { gte: daysAgo(30) },
      },
      _sum: { amount: true },
    }),
    db.cashDelivery.groupBy({
      by: ["commissionCurrencyId"],
      where: {
        commissionStatus: "pending",
        commissionAmount: { gt: 0 },
        status: { not: "cancelled" },
      },
      _sum: { commissionAmount: true },
      _count: { _all: true },
    }),
  ]);

  const balanceByCurrency = currencies.map((c) => {
    const agg = accountAggregates.find((a) => a.currencyId === c.currencyId);
    return {
      currencyId: c.currencyId,
      code: c.code,
      symbol: c.symbol,
      decimalPlaces: c.decimalPlaces,
      total: Number(agg?._sum.balance ?? 0),
      accountsCount: agg?._count._all ?? 0,
    };
  });

  // Flujos por moneda (inflow vs outflow) últimos 30 días
  const flowMap = new Map<number, { code: string; inflow: number; outflow: number }>();
  for (const c of currencies) flowMap.set(c.currencyId, { code: c.code, inflow: 0, outflow: 0 });
  for (const f of flowLast30) {
    const cur = flowMap.get(f.currencyId);
    if (!cur) continue;
    const amount = Number(f._sum.amount ?? 0);
    if (f.type === "deposit" || f.type === "transfer_in") cur.inflow += amount;
    else if (f.type === "withdrawal" || f.type === "transfer_out") cur.outflow += amount;
    // adjustments no cuentan en el chart de flujos para evitar ruido
  }
  const flowSeries = Array.from(flowMap.values()).filter((v) => v.inflow > 0 || v.outflow > 0);

  // Comisiones por pagar: se agrupan por moneda sin convertir, porque envios y
  // el módulo currency usan sistemas de tasa distintos e incompatibles.
  const pendingCommissionsCount = pendingCommissions.reduce((n, c) => n + c._count._all, 0);
  const pendingCommissionByCurrency = pendingCommissions.flatMap((c) => {
    const currency = currencies.find((x) => x.currencyId === c.commissionCurrencyId);
    if (!currency) return [];
    return [
      {
        currencyId: currency.currencyId,
        code: currency.code,
        symbol: currency.symbol,
        decimalPlaces: currency.decimalPlaces,
        total: Number(c._sum.commissionAmount ?? 0),
        count: c._count._all,
      },
    ];
  });

  return {
    balanceByCurrency,
    pendingCommissionsCount,
    pendingCommissionByCurrency,
    pendingCount,
    activeGroupsCount,
    totalAccountsCount,
    todayOpsCount,
    recentOps,
    pendingTop,
    flowSeries,
    generatedAt: new Date(),
  };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
