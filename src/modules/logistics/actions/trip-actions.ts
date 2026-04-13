"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function createTrip(data: {
  driver_id: number;
  load_date?: string;
  load_time?: string;
  trip_payment?: string;
  province?: string;
  product?: string;
  containers?: { serial_number: string; type?: string }[];
}): Promise<ActionResult<{ trip_id: number }>> {
  try {
    const trip = await db.trip.create({
      data: {
        driverId: data.driver_id,
        loadDate: data.load_date || null,
        loadTime: data.load_time || null,
        tripPayment: data.trip_payment || null,
        province: data.province || null,
        product: data.product || null,
        ...(data.containers?.length && {
          containers: {
            create: data.containers.map((c) => ({
              serialNumber: c.serial_number,
              type: c.type || null,
            })),
          },
        }),
      },
    });

    revalidatePath("/trips");
    revalidatePath(`/drivers/${data.driver_id}`);
    return { success: true, data: { trip_id: trip.tripId } };
  } catch (error) {
    console.error("Error creating trip:", error);
    return { success: false, error: "Error al crear el viaje" };
  }
}

export async function updateTrip(
  id: number,
  data: {
    driver_id?: number;
    load_date?: string;
    load_time?: string;
    trip_payment?: string;
    province?: string;
    product?: string;
  }
): Promise<ActionResult<void>> {
  try {
    await db.trip.update({
      where: { tripId: id },
      data: {
        ...(data.driver_id !== undefined && { driverId: data.driver_id }),
        ...(data.load_date !== undefined && { loadDate: data.load_date }),
        ...(data.load_time !== undefined && { loadTime: data.load_time }),
        ...(data.trip_payment !== undefined && {
          tripPayment: data.trip_payment,
        }),
        ...(data.province !== undefined && { province: data.province }),
        ...(data.product !== undefined && { product: data.product }),
      },
    });

    revalidatePath("/trips");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating trip:", error);
    return { success: false, error: "Error al actualizar el viaje" };
  }
}

export async function deleteTrip(
  id: number
): Promise<ActionResult<void>> {
  try {
    await db.trip.delete({ where: { tripId: id } });
    revalidatePath("/trips");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting trip:", error);
    return { success: false, error: "Error al eliminar el viaje" };
  }
}
