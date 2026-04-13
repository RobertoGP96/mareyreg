import { db } from "@/lib/db";

export async function getDrivers() {
  return db.driver.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getDriver(id: number) {
  return db.driver.findUnique({ where: { driverId: id } });
}

export async function getDriverByIdentification(identificationNumber: string) {
  return db.driver.findUnique({ where: { identificationNumber } });
}

export async function getDriverWithDetails(id: number) {
  const result = await db.driver.findUnique({
    where: { driverId: id },
    include: {
      vehicles: true,
      trips: { orderBy: { loadDate: "desc" } },
    },
  });

  if (!result) return null;

  const { vehicles, trips, ...driver } = result;
  return { driver, vehicles, trips };
}
