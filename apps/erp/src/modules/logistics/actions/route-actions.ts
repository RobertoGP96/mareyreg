"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export type RouteInput = {
  origin_province: string;
  destination_province: string;
  distance_km?: number | null;
  estimated_hours?: number | null;
  description?: string | null;
};

export async function createRoute(
  data: RouteInput
): Promise<ActionResult<{ route_id: number }>> {
  try {
    if (!data.origin_province || !data.destination_province) {
      return { success: false, error: "Origen y destino son requeridos" };
    }
    const r = await db.route.create({
      data: {
        originProvince: data.origin_province,
        destinationProvince: data.destination_province,
        distanceKm: data.distance_km ?? null,
        estimatedHours: data.estimated_hours ?? null,
        description: data.description ?? null,
      },
    });
    revalidatePath("/routes");
    return { success: true, data: { route_id: r.routeId } };
  } catch (error) {
    console.error("Error creating route:", error);
    return { success: false, error: "Error al crear la ruta" };
  }
}

export async function updateRoute(
  id: number,
  data: Partial<RouteInput>
): Promise<ActionResult<void>> {
  try {
    await db.route.update({
      where: { routeId: id },
      data: {
        ...(data.origin_province !== undefined && { originProvince: data.origin_province }),
        ...(data.destination_province !== undefined && { destinationProvince: data.destination_province }),
        ...(data.distance_km !== undefined && { distanceKm: data.distance_km }),
        ...(data.estimated_hours !== undefined && { estimatedHours: data.estimated_hours }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });
    revalidatePath("/routes");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating route:", error);
    return { success: false, error: "Error al actualizar la ruta" };
  }
}

export async function deleteRoute(id: number): Promise<ActionResult<void>> {
  try {
    await db.route.delete({ where: { routeId: id } });
    revalidatePath("/routes");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting route:", error);
    return { success: false, error: "No se pudo eliminar (puede tener viajes asociados)" };
  }
}
