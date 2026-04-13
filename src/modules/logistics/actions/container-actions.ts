"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function createContainer(data: {
  trip_id: number;
  serial_number: string;
  type?: string;
}): Promise<ActionResult<{ container_id: number }>> {
  try {
    const container = await db.container.create({
      data: {
        tripId: data.trip_id,
        serialNumber: data.serial_number,
        type: data.type || null,
      },
    });

    revalidatePath("/trips");
    return { success: true, data: { container_id: container.containerId } };
  } catch (error) {
    console.error("Error creating container:", error);
    return { success: false, error: "Error al crear el contenedor" };
  }
}

export async function deleteContainer(
  id: number
): Promise<ActionResult<void>> {
  try {
    await db.container.delete({ where: { containerId: id } });
    revalidatePath("/trips");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting container:", error);
    return { success: false, error: "Error al eliminar el contenedor" };
  }
}
