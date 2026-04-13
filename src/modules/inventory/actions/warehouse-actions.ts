"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function createWarehouse(data: {
  name: string;
  location?: string;
  province?: string;
  capacity?: number;
}): Promise<ActionResult<{ warehouseId: number }>> {
  try {
    const warehouse = await db.warehouse.create({
      data: {
        name: data.name,
        location: data.location || null,
        province: data.province || null,
        capacity: data.capacity || null,
      },
    });

    revalidatePath("/warehouses");
    return { success: true, data: { warehouseId: warehouse.warehouseId } };
  } catch (error) {
    console.error("Error creating warehouse:", error);
    return { success: false, error: "Error al crear el almacen" };
  }
}

export async function updateWarehouse(
  id: number,
  data: { name?: string; location?: string; province?: string; capacity?: number }
): Promise<ActionResult<void>> {
  try {
    await db.warehouse.update({
      where: { warehouseId: id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.province !== undefined && { province: data.province }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
      },
    });

    revalidatePath("/warehouses");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating warehouse:", error);
    return { success: false, error: "Error al actualizar el almacen" };
  }
}

export async function deleteWarehouse(id: number): Promise<ActionResult<void>> {
  try {
    await db.warehouse.delete({ where: { warehouseId: id } });
    revalidatePath("/warehouses");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting warehouse:", error);
    return { success: false, error: "Error al eliminar el almacen. Verifique que no tiene stock o pacas asociadas." };
  }
}
