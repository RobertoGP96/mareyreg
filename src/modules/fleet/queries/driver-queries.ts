import { db } from "@/lib/db";

export async function getDrivers() {
  return db.driver.findMany({
    include: { entity: true },
    orderBy: { createdAt: "desc" },
  });
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
      entity: true,
      vehicles: true,
      trips: {
        include: { containers: true },
        orderBy: { loadDate: "desc" },
      },
    },
  });

  if (!result) return null;

  const { vehicles, trips, entity, ...driver } = result;
  return { driver: { ...driver, entity }, vehicles, trips };
}
