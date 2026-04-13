import { db } from "@/lib/db";

export async function getTrips() {
  const result = await db.trip.findMany({
    include: { driver: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return result.map((row) => ({
    tripId: row.tripId,
    driverId: row.driverId,
    containerNumber: row.containerNumber,
    loadDate: row.loadDate,
    loadTime: row.loadTime,
    tripPayment: row.tripPayment,
    province: row.province,
    product: row.product,
    status: row.status,
    createdAt: row.createdAt,
    driverFullName: row.driver.fullName,
  }));
}

export async function getTrip(id: number) {
  return db.trip.findUnique({ where: { tripId: id } });
}

export async function getTripsByDriver(driverId: number) {
  return db.trip.findMany({
    where: { driverId },
    orderBy: { loadDate: "desc" },
  });
}
