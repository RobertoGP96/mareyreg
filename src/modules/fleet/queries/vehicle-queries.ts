import { db } from "@/lib/db";

export async function getVehicles() {
  const result = await db.vehicle.findMany({
    include: { driver: true },
    orderBy: { createdAt: "desc" },
  });

  return result.map((row) => ({
    vehicle_id: row.vehicleId,
    name: row.name,
    cuña_circulation_number: row.cunaCirculationNumber,
    plancha_circulation_number: row.planchaCirculationNumber,
    cuña_plate_number: row.cunaPlateNumber,
    plancha_plate_number: row.planchaPlateNumber,
    driver_id: row.driverId,
    status: row.status,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    driver: row.driver
      ? {
          driver_id: row.driver.driverId,
          full_name: row.driver.fullName,
          identification_number: row.driver.identificationNumber,
          phone_number: row.driver.phoneNumber,
          operative_license: row.driver.operativeLicense,
        }
      : null,
  }));
}

export async function getVehicle(id: number) {
  return db.vehicle.findUnique({ where: { vehicleId: id } });
}
