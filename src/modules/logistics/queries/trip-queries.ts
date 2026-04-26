import { db } from "@/lib/db";

export async function getTrips() {
  const result = await db.trip.findMany({
    include: {
      driver: { select: { fullName: true } },
      route: {
        select: {
          routeId: true,
          originProvince: true,
          destinationProvince: true,
          distanceKm: true,
        },
      },
      containers: true,
      _count: { select: { cargo: true, payments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return result.map((row) => ({
    tripId: row.tripId,
    driverId: row.driverId,
    routeId: row.routeId,
    loadDate: row.loadDate,
    loadTime: row.loadTime,
    tripPayment: row.tripPayment,
    province: row.province,
    product: row.product,
    status: row.status,
    createdAt: row.createdAt,
    driverFullName: row.driver.fullName,
    route: row.route
      ? {
          routeId: row.route.routeId,
          originProvince: row.route.originProvince,
          destinationProvince: row.route.destinationProvince,
          distanceKm: row.route.distanceKm ? Number(row.route.distanceKm) : null,
        }
      : null,
    containers: row.containers.map((c) => ({
      containerId: c.containerId,
      serialNumber: c.serialNumber,
      type: c.type,
    })),
    cargoCount: row._count.cargo,
    paymentsCount: row._count.payments,
  }));
}

export type TripListRow = Awaited<ReturnType<typeof getTrips>>[number];

export async function getTrip(id: number) {
  return db.trip.findUnique({
    where: { tripId: id },
    include: { containers: true },
  });
}

export async function getTripsByDriver(driverId: number) {
  return db.trip.findMany({
    where: { driverId },
    include: { containers: true },
    orderBy: { loadDate: "desc" },
  });
}

export async function getTripWithDetails(id: number) {
  const result = await db.trip.findUnique({
    where: { tripId: id },
    include: {
      driver: {
        include: {
          entity: true,
          vehicles: true,
        },
      },
      route: true,
      containers: { orderBy: { createdAt: "asc" } },
      cargo: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!result) return null;

  const { driver, containers, route, cargo, payments, ...trip } = result;
  const { entity, vehicles, ...driverOnly } = driver;

  return {
    trip,
    driver: driverOnly,
    entity,
    vehicles,
    containers,
    route: route
      ? {
          routeId: route.routeId,
          originProvince: route.originProvince,
          destinationProvince: route.destinationProvince,
          distanceKm: route.distanceKm ? Number(route.distanceKm) : null,
          estimatedHours: route.estimatedHours ? Number(route.estimatedHours) : null,
          description: route.description,
        }
      : null,
    cargo: cargo.map((c) => ({
      cargoId: c.cargoId,
      productName: c.productName,
      weightKg: c.weightKg ? Number(c.weightKg) : null,
      cargoType: c.cargoType,
      description: c.description,
    })),
    payments: payments.map((p) => ({
      paymentId: p.paymentId,
      amount: Number(p.amount),
      paymentDate: p.paymentDate,
      paymentMethod: p.paymentMethod,
      status: p.status,
      notes: p.notes,
    })),
  };
}
