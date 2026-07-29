"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function createEntity(data: {
  name: string;
}): Promise<ActionResult<{ entity_id: number }>> {
  try {
    const entity = await db.entity.create({
      data: { name: data.name },
    });

    revalidatePath("/entities");
    revalidatePath("/drivers");
    return { success: true, data: { entity_id: entity.entityId } };
  } catch (error) {
    console.error("Error creating entity:", error);
    return { success: false, error: "Error al crear la entidad" };
  }
}

export async function updateEntity(
  id: number,
  data: { name?: string }
): Promise<ActionResult<void>> {
  try {
    await db.entity.update({
      where: { entityId: id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
      },
    });

    revalidatePath("/entities");
    revalidatePath("/drivers");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating entity:", error);
    return { success: false, error: "Error al actualizar la entidad" };
  }
}

export async function deleteEntity(
  id: number
): Promise<ActionResult<void>> {
  try {
    const driversCount = await db.driver.count({ where: { entityId: id } });
    if (driversCount > 0) {
      return {
        success: false,
        error: `No se puede eliminar la entidad porque tiene ${driversCount} conductor(es) asociado(s).`,
      };
    }

    await db.entity.delete({ where: { entityId: id } });
    revalidatePath("/entities");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting entity:", error);
    return { success: false, error: "Error al eliminar la entidad" };
  }
}
