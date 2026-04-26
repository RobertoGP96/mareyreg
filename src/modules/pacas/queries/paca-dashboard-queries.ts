import { db } from "@/lib/db";

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Aggregated dashboard data for the pacas module.
 * Counts inventory, sales (last 30d), reservations and top categories — designed
 * for a data-dense control-room style dashboard.
 */
export async function getPacaDashboard() {
  const since30 = daysAgoIso(30);

  const [inventory, sales30, reservations, clientsActive, categoriesCount] =
    await Promise.all([
      db.pacaInventory.findMany({
        include: {
          category: { include: { classification: true } },
        },
      }),
      db.pacaSale.findMany({
        where: { createdAt: { gte: since30 } },
        select: {
          saleId: true,
          quantity: true,
          salePrice: true,
          saleDate: true,
          createdAt: true,
          clientName: true,
          paymentMethod: true,
          category: { select: { name: true, classification: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.pacaReservation.findMany({
        select: {
          reservationId: true,
          status: true,
          quantity: true,
          clientName: true,
          reservationDate: true,
          expirationDate: true,
          category: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.pacaClient.count({ where: { isActive: true } }),
      db.pacaCategory.count(),
    ]);

  const totalAvailable = inventory.reduce((acc, i) => acc + i.available, 0);
  const totalReserved = inventory.reduce((acc, i) => acc + i.reserved, 0);
  const totalSold = inventory.reduce((acc, i) => acc + i.sold, 0);
  const stockValue = inventory.reduce((acc, i) => acc + Number(i.totalCost), 0);

  // Sales aggregates
  const totalUnitsSold30 = sales30.reduce((acc, s) => acc + s.quantity, 0);
  const totalRevenue30 = sales30.reduce(
    (acc, s) => acc + s.quantity * Number(s.salePrice),
    0
  );

  // 14-day spark — units sold per day
  const spark14: number[] = Array.from({ length: 14 }, () => 0);
  for (const s of sales30) {
    const diff = Math.floor(
      (Date.now() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff >= 0 && diff < 14) spark14[13 - diff] += s.quantity;
  }

  // Top categories by available stock
  const topCategories = [...inventory]
    .sort((a, b) => b.available - a.available)
    .slice(0, 6)
    .map((i) => ({
      categoryId: i.categoryId,
      name: i.category.name,
      classification: i.category.classification?.name ?? null,
      available: i.available,
      reserved: i.reserved,
      sold: i.sold,
    }));

  // Reservation status counts
  const reservationCounts = reservations.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    { active: 0, completed: 0, cancelled: 0 } as Record<string, number>
  );

  // Recent sales feed (8)
  const recentSales = sales30.slice(0, 8).map((s) => ({
    saleId: s.saleId,
    clientName: s.clientName,
    category: s.category.name,
    quantity: s.quantity,
    total: s.quantity * Number(s.salePrice),
    saleDate: s.saleDate,
    paymentMethod: s.paymentMethod,
  }));

  // Active reservations expiring soon (within 14 days)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 14);
  const expiringSoon = reservations
    .filter((r) => r.status === "active" && r.expirationDate)
    .filter((r) => {
      const exp = new Date(r.expirationDate as string);
      return exp >= today && exp <= horizon;
    })
    .slice(0, 5);

  return {
    counts: {
      available: totalAvailable,
      reserved: totalReserved,
      sold: totalSold,
      total: totalAvailable + totalReserved + totalSold,
      stockValue,
      categoriesCount,
      clientsActive,
    },
    sales30: {
      units: totalUnitsSold30,
      revenue: totalRevenue30,
      spark14,
      recent: recentSales,
    },
    reservations: {
      active: reservationCounts.active,
      completed: reservationCounts.completed,
      cancelled: reservationCounts.cancelled,
      expiringSoon,
    },
    topCategories,
  };
}

export type PacaDashboardData = Awaited<ReturnType<typeof getPacaDashboard>>;
