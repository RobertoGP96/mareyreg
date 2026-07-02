"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { CargoType } from "@/generated/prisma";

export type CargoInput = {
  trip_id: number;
  product_name: string;
  weight_kg?: number | null;
  cargo_type?: CargoType;
  description?: string | null;
};

export async function createCargo(data: CargoInput): Promise<ActionResult<{ cargo_id: number }>> {
  try {
    if (!data.product_name?.trim()) return { success: false, error: "Producto requerido" };
    const c = await db.cargo.create({
      data: {
        tripId: data.trip_id,
        productName: data.product_name.trim(),
        weightKg: data.weight_kg ?? null,
        cargoType: data.cargo_type ?? "general",
        description: data.description ?? null,
      },
    });
    revalidatePath(`/trips/${data.trip_id}`);
    return { success: true, data: { cargo_id: c.cargoId } };
  } catch (error) {
    console.error("Error creating cargo:", error);
    return { success: false, error: "Error al agregar carga" };
  }
}

export async function deleteCargo(id: number, tripId: number): Promise<ActionResult<void>> {
  try {
    await db.cargo.delete({ where: { cargoId: id } });
    revalidatePath(`/trips/${tripId}`);
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting cargo:", error);
    return { success: false, error: "Error al eliminar carga" };
  }
}
