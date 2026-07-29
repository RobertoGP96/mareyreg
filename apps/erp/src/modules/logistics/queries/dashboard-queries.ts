import { db } from "@/lib/db";

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getLogisticsDashboard() {
  const since30 = daysAgoIso(30);
  const since14 = daysAgoIso(14);

  const [trips, drivers, vehicles, payments] = await Promise.all([
    db.trip.findMany({
      where: { createdAt: { gte: since30 } },
      select: {
        tripId: true,
        status: true,
        province: true,
        loadDate: true,
        loadTime: true,
        product: true,
        createdAt: true,
        driver: { select: { fullName: true } },
        _count: { select: { containers: true, cargo: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.driver.count(),
    db.vehicle.count(),
    db.payment.findMany({
      where: { createdAt: { gte: since30 } },
      select: { amount: true, status: true },
    }),
  ]);

  const counts = trips.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Per-day spark for last 14 days (count of trips by createdAt)
  const sparkBuckets: number[] = Array.from({ length: 14 }, () => 0);
  for (const t of trips) {
    const diff = Math.floor(
      (Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff >= 0 && diff < 14) sparkBuckets[13 - diff] += 1;
  }

  const provinceDist: Record<string, number> = {};
  for (const t of trips) {
    if (!t.province) continue;
    provinceDist[t.province] = (provinceDist[t.province] ?? 0) + 1;
  }
  const topProvinces = Object.entries(provinceDist)
    .map(([province, count]) => ({ province, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const driverActivity: Record<string, number> = {};
  for (const t of trips) {
    const name = t.driver?.fullName ?? "—";
    driverActivity[name] = (driverActivity[name] ?? 0) + 1;
  }
  const topDrivers = Object.entries(driverActivity)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((acc, p) => acc + Number(p.amount), 0);
  const totalPending = payments
    .filter((p) => p.status === "pending")
    .reduce((acc, p) => acc + Number(p.amount), 0);

  // Activity feed: last 8 trips with non-completed status take priority
  const activeFeed = trips
    .slice()
    .sort((a, b) => {
      const order = { in_progress: 0, scheduled: 1, completed: 2, cancelled: 3 } as const;
      return (order[a.status] - order[b.status]) || (b.createdAt.getTime() - a.createdAt.getTime());
    })
    .slice(0, 8)
    .map((t) => ({
      id: t.tripId,
      title: t.driver?.fullName ?? `Viaje #${t.tripId}`,
      subtitle: [t.province, t.product].filter(Boolean).join(" · ") || "Sin destino",
      status: t.status,
      time: t.loadDate ?? t.createdAt.toISOString().slice(0, 10),
    }));

  return {
    counts: {
      total: trips.length,
      scheduled: counts.scheduled ?? 0,
      inProgress: counts.in_progress ?? 0,
      completed: counts.completed ?? 0,
      cancelled: counts.cancelled ?? 0,
    },
    drivers,
    vehicles,
    payments: { paid: totalPaid, pending: totalPending },
    spark14: sparkBuckets,
    topProvinces,
    topDrivers,
    activeFeed,
    since14,
  };
}

export type LogisticsDashboardData = Awaited<ReturnType<typeof getLogisticsDashboard>>;
