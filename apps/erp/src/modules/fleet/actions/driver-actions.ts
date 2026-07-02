"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { getDriverByIdentification } from "../queries/driver-queries";

export async function createDriver(data: {
  entity_id: number;
  full_name: string;
  identification_number: string;
  phone_number: string;
  operative_license?: string;
  vehicleData?: {
    name?: string;
    cuña_circulation_number?: string;
    plancha_circulation_number?: string;
    cuña_plate_number?: string;
    plancha_plate_number?: string;
  };
}): Promise<ActionResult<{ driver_id: number }>> {
  try {
    const existing = await getDriverByIdentification(
      data.identification_number
    );
    if (existing) {
      return {
        success: false,
        error: `Ya existe un conductor con la identificacion ${data.identification_number}`,
      };
    }

    const driver = await db.driver.create({
      data: {
        entityId: data.entity_id,
        fullName: data.full_name,
        identificationNumber: data.identification_number,
        phoneNumber: data.phone_number,
        operativeLicense: data.operative_license || null,
      },
    });

    if (data.vehicleData) {
      await db.vehicle.create({
        data: {
          name: data.vehicleData.name || null,
          cunaCirculationNumber:
            data.vehicleData.cuña_circulation_number || null,
          planchaCirculationNumber:
            data.vehicleData.plancha_circulation_number || null,
          cunaPlateNumber: data.vehicleData.cuña_plate_number || null,
          planchaPlateNumber: data.vehicleData.plancha_plate_number || null,
          driverId: driver.driverId,
        },
      });
    }

    revalidatePath("/drivers");
    revalidatePath("/vehicles");
    return { success: true, data: { driver_id: driver.driverId } };
  } catch (error) {
    console.error("Error creating driver:", error);
    return { success: false, error: "Error al crear el conductor" };
  }
}

export async function updateDriver(
  id: number,
  data: {
    entity_id?: number;
    full_name?: string;
    identification_number?: string;
    phone_number?: string;
    operative_license?: string;
  }
): Promise<ActionResult<void>> {
  try {
    await db.driver.update({
      where: { driverId: id },
      data: {
        ...(data.entity_id !== undefined && { entityId: data.entity_id }),
        ...(data.full_name !== undefined && { fullName: data.full_name }),
        ...(data.identification_number !== undefined && {
          identificationNumber: data.identification_number,
        }),
        ...(data.phone_number !== undefined && {
          phoneNumber: data.phone_number,
        }),
        ...(data.operative_license !== undefined && {
          operativeLicense: data.operative_license,
        }),
      },
    });

    revalidatePath("/drivers");
    revalidatePath(`/drivers/${id}`);
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating driver:", error);
    return { success: false, error: "Error al actualizar el conductor" };
  }
}

export async function deleteDriver(
  id: number
): Promise<ActionResult<void>> {
  try {
    await db.driver.delete({ where: { driverId: id } });
    revalidatePath("/drivers");
    revalidatePath("/vehicles");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting driver:", error);
    return {
      success: false,
      error:
        "Error al eliminar el conductor. Asegurese de que no tiene viajes o vehiculos asociados.",
    };
  }
}
