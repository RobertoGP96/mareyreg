"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";

export async function createWarehouse(data: {
  name: string;
  location?: string;
  province?: string;
  capacity?: number;
  warehouseType?: string;
  contactPhone?: string;
}): Promise<ActionResult<{ warehouseId: number }>> {
  try {
    const userId = await getCurrentUserId();
    const warehouse = await db.$transaction(async (tx) => {
      const w = await tx.warehouse.create({
        data: {
          name: data.name,
          location: data.location || null,
          province: data.province || null,
          capacity: data.capacity || null,
          warehouseType: data.warehouseType || null,
          contactPhone: data.contactPhone || null,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "Warehouse",
        entityId: w.warehouseId,
        module: "inventory",
        userId,
        newValues: data,
      });
      return w;
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
  data: {
    name?: string;
    location?: string;
    province?: string;
    capacity?: number;
    warehouseType?: string;
    contactPhone?: string;
    isActive?: boolean;
  }
): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.warehouse.findUnique({ where: { warehouseId: id } });
      await tx.warehouse.update({
        where: { warehouseId: id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.province !== undefined && { province: data.province }),
          ...(data.capacity !== undefined && { capacity: data.capacity }),
          ...(data.warehouseType !== undefined && { warehouseType: data.warehouseType || null }),
          ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone || null }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Warehouse",
        entityId: id,
        module: "inventory",
        userId,
        oldValues: prev,
        newValues: data,
      });
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
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.warehouse.findUnique({ where: { warehouseId: id } });
      await tx.warehouse.delete({ where: { warehouseId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "Warehouse",
        entityId: id,
        module: "inventory",
        userId,
        oldValues: prev,
      });
    });
    revalidatePath("/warehouses");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting warehouse:", error);
    return { success: false, error: "Error al eliminar el almacen. Verifique que no tiene stock o pacas asociadas." };
  }
}
