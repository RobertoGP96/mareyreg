import { db } from "@/lib/db";

export async function getTrips() {
  const result = await db.trip.findMany({
    include: {
      driver: { select: { fullName: true } },
      containers: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return result.map((row) => ({
    tripId: row.tripId,
    driverId: row.driverId,
    loadDate: row.loadDate,
    loadTime: row.loadTime,
    tripPayment: row.tripPayment,
    province: row.province,
    product: row.product,
    status: row.status,
    createdAt: row.createdAt,
    driverFullName: row.driver.fullName,
    containers: row.containers.map((c) => ({
      containerId: c.containerId,
      serialNumber: c.serialNumber,
      type: c.type,
    })),
  }));
}

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
      containers: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!result) return null;

  const { driver, containers, ...trip } = result;
  const { entity, vehicles, ...driverOnly } = driver;

  return {
    trip,
    driver: driverOnly,
    entity,
    vehicles,
    containers,
  };
}
