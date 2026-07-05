"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";

const FORBIDDEN_ERROR_MESSAGE = "No tienes permisos para realizar esta acción";

const updateWebstoreWarehouseInputSchema = z.object({
  warehouseId: z.number().int().positive().nullable(),
});

export type UpdateWebstoreWarehouseInput = z.input<typeof updateWebstoreWarehouseInputSchema>;

export async function updateWebstoreWarehouse(
  input: UpdateWebstoreWarehouseInput
): Promise<ActionResult<{ warehouseId: number | null }>> {
  try {
    const parsed = updateWebstoreWarehouseInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { warehouseId } = parsed.data;

    const userId = await requireCurrentUserId();
    await assertRole("admin");

    // Validación dentro de la misma tx que el upsert para minimizar la
    // ventana en que otro proceso desactive el almacén entre check y guardado.
    const saved = await db.$transaction(async (tx) => {
      if (warehouseId != null) {
        const warehouse = await tx.warehouse.findUnique({
          where: { warehouseId },
          select: { isActive: true },
        });
        if (!warehouse?.isActive) return false;
      }

      const current = await tx.company.findUnique({
        where: { id: 1 },
        select: { webstoreWarehouseId: true },
      });
      await tx.company.upsert({
        where: { id: 1 },
        update: { webstoreWarehouseId: warehouseId },
        // Mismo default de nombre que getCompany() para instalaciones donde
        // la fila company aún no existe.
        create: { id: 1, name: "GR Technology", webstoreWarehouseId: warehouseId },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Company",
        entityId: 1,
        module: "webstore",
        userId,
        oldValues: { webstoreWarehouseId: current?.webstoreWarehouseId ?? null },
        newValues: { webstoreWarehouseId: warehouseId },
      });
      return true;
    });

    if (!saved) {
      return { success: false, error: "El almacén seleccionado no existe o está inactivo" };
    }

    revalidatePath("/webstore/configuracion");
    return { success: true, data: { warehouseId } };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    console.error("updateWebstoreWarehouse:", error);
    return { success: false, error: "Error al guardar la configuración de la tienda" };
  }
}
