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
    revalidatePath(`/trips/${data.trip_id}`);
    return { success: true, data: { container_id: container.containerId } };
  } catch (error) {
    console.error("Error creating container:", error);
    return { success: false, error: "Error al crear el contenedor" };
  }
}

export async function createContainersBulk(data: {
  trip_id: number;
  serial_numbers: string[];
  type?: string;
}): Promise<ActionResult<{ created: number; skipped: number }>> {
  try {
    // Dedup + limpiar seriales
    const unique = Array.from(
      new Set(
        data.serial_numbers
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      )
    );

    if (unique.length === 0) {
      return {
        success: false,
        error: "No se recibieron numeros de serie validos",
      };
    }

    const payload = unique.map((serialNumber) => ({
      tripId: data.trip_id,
      serialNumber,
      type: data.type || null,
    }));

    const result = await db.container.createMany({
      data: payload,
      skipDuplicates: true,
    });

    revalidatePath("/trips");
    revalidatePath(`/trips/${data.trip_id}`);
    return {
      success: true,
      data: {
        created: result.count,
        skipped: unique.length - result.count,
      },
    };
  } catch (error) {
    console.error("Error creating containers bulk:", error);
    return { success: false, error: "Error al crear los contenedores" };
  }
}

export async function deleteContainer(
  id: number
): Promise<ActionResult<void>> {
  try {
    const container = await db.container.delete({
      where: { containerId: id },
    });
    revalidatePath("/trips");
    revalidatePath(`/trips/${container.tripId}`);
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting container:", error);
    return { success: false, error: "Error al eliminar el contenedor" };
  }
}
