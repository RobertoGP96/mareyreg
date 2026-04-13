"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function createVehicle(data: {
  name?: string;
  cuña_circulation_number?: string;
  plancha_circulation_number?: string;
  cuña_plate_number?: string;
  plancha_plate_number?: string;
  driver_id?: number;
  createDriver?: boolean;
  driverData?: {
    full_name: string;
    identification_number: string;
    phone_number: string;
    operative_license?: string;
  };
}): Promise<ActionResult<{ vehicle_id: number }>> {
  try {
    let driverId = data.driver_id ?? null;

    // Create driver if requested
    if (data.createDriver && data.driverData) {
      const newDriver = await db.driver.create({
        data: {
          fullName: data.driverData.full_name,
          identificationNumber: data.driverData.identification_number,
          phoneNumber: data.driverData.phone_number,
          operativeLicense: data.driverData.operative_license || null,
        },
      });
      driverId = newDriver.driverId;
    }

    const vehicle = await db.vehicle.create({
      data: {
        name: data.name || null,
        cunaCirculationNumber: data.cuña_circulation_number || null,
        planchaCirculationNumber: data.plancha_circulation_number || null,
        cunaPlateNumber: data.cuña_plate_number || null,
        planchaPlateNumber: data.plancha_plate_number || null,
        driverId,
      },
    });

    revalidatePath("/vehicles");
    revalidatePath("/drivers");
    return { success: true, data: { vehicle_id: vehicle.vehicleId } };
  } catch (error) {
    console.error("Error creating vehicle:", error);
    return { success: false, error: "Error al crear el vehiculo" };
  }
}

export async function updateVehicle(
  id: number,
  data: {
    name?: string;
    cuña_circulation_number?: string;
    plancha_circulation_number?: string;
    cuña_plate_number?: string;
    plancha_plate_number?: string;
    driver_id?: number | null;
  }
): Promise<ActionResult<void>> {
  try {
    await db.vehicle.update({
      where: { vehicleId: id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.cuña_circulation_number !== undefined && {
          cunaCirculationNumber: data.cuña_circulation_number,
        }),
        ...(data.plancha_circulation_number !== undefined && {
          planchaCirculationNumber: data.plancha_circulation_number,
        }),
        ...(data.cuña_plate_number !== undefined && {
          cunaPlateNumber: data.cuña_plate_number,
        }),
        ...(data.plancha_plate_number !== undefined && {
          planchaPlateNumber: data.plancha_plate_number,
        }),
        ...(data.driver_id !== undefined && { driverId: data.driver_id }),
      },
    });

    revalidatePath("/vehicles");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating vehicle:", error);
    return { success: false, error: "Error al actualizar el vehiculo" };
  }
}

export async function deleteVehicle(
  id: number
): Promise<ActionResult<void>> {
  try {
    await db.vehicle.delete({ where: { vehicleId: id } });
    revalidatePath("/vehicles");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting vehicle:", error);
    return { success: false, error: "Error al eliminar el vehiculo" };
  }
}
