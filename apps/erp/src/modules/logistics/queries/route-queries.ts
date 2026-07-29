import { db } from "@/lib/db";

export async function getRoutes() {
  const rows = await db.route.findMany({
    include: {
      _count: { select: { trips: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    routeId: r.routeId,
    originProvince: r.originProvince,
    destinationProvince: r.destinationProvince,
    distanceKm: r.distanceKm ? Number(r.distanceKm) : null,
    estimatedHours: r.estimatedHours ? Number(r.estimatedHours) : null,
    description: r.description,
    createdAt: r.createdAt,
    tripsCount: r._count.trips,
  }));
}

export type RouteRow = Awaited<ReturnType<typeof getRoutes>>[number];

export async function getRouteOptions() {
  const rows = await db.route.findMany({
    select: {
      routeId: true,
      originProvince: true,
      destinationProvince: true,
      distanceKm: true,
    },
    orderBy: [{ originProvince: "asc" }, { destinationProvince: "asc" }],
  });
  return rows.map((r) => ({
    routeId: r.routeId,
    label: `${r.originProvince} → ${r.destinationProvince}`,
    distanceKm: r.distanceKm ? Number(r.distanceKm) : null,
  }));
}

export type RouteOption = Awaited<ReturnType<typeof getRouteOptions>>[number];
