"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { Prisma } from "@/generated/prisma";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { calculateWeightedCost } from "@/modules/pacas/lib/weighted-cost";
import { recordShadowMovement } from "@/modules/pacas/lib/shadow-product";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

export async function createSale(data: {
  categoryId: number;
  quantity: number;
  salePrice: number;
  clientName: string;
  clientPhone?: string;
  paymentMethod?: string;
  saleDate: string;
  notes?: string;
}): Promise<ActionResult<{ saleId: number }>> {
  try {
    if (!Number.isInteger(data.quantity) || data.quantity < 1) {
      return { success: false, error: "La cantidad debe ser un entero mayor o igual a 1" };
    }
    if (data.salePrice < 0) {
      return { success: false, error: "El precio de venta no puede ser negativo" };
    }

    const userId = await requireCurrentUserId();

    const sale = await db.$transaction(async (tx) => {
      // Costo promedio calculado dentro de la tx, antes del decremento atómico:
      // usamos el snapshot pre-update porque avgCost representa el costo
      // acumulado del lote actual; si otra tx concurrente ya lo modificó,
      // el updateMany atómico de abajo fallará por la condición `available >= quantity`
      // y reintentar recalcula un avgCost fresco.
      const inventory = await tx.pacaInventory.findUnique({
        where: { categoryId: data.categoryId },
      });
      if (!inventory) {
        throw new Error("No hay inventario para esta categoria");
      }
      const { costToDeduct } = calculateWeightedCost(inventory, data.quantity);

      const updated = await tx.pacaInventory.updateMany({
        where: { categoryId: data.categoryId, available: { gte: data.quantity } },
        data: {
          available: { decrement: data.quantity },
          sold: { increment: data.quantity },
          totalCost: { decrement: costToDeduct },
        },
      });
      if (updated.count !== 1) {
        throw new Error("No hay suficientes pacas disponibles");
      }

      const s = await tx.pacaSale.create({
        data: {
          categoryId: data.categoryId,
          quantity: data.quantity,
          salePrice: data.salePrice,
          costOfGoods: costToDeduct,
          clientName: data.clientName,
          clientPhone: data.clientPhone || null,
          paymentMethod: data.paymentMethod || null,
          saleDate: data.saleDate,
          notes: data.notes || null,
        },
      });

      await recordShadowMovement(tx, {
        categoryId: data.categoryId,
        quantity: data.quantity,
        unitCost: data.quantity > 0 ? costToDeduct / data.quantity : 0,
        movementType: "exit",
        reference: `paca:venta #${s.saleId}`,
        userId,
      });

      await createAuditLog(tx, {
        action: "create",
        entityType: "PacaSale",
        entityId: s.saleId,
        module: "pacas",
        userId,
        newValues: { ...data, costToDeduct },
      });

      return s;
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/ventas");
    revalidatePath("/pacas/disponibilidad");
    return { success: true, data: { saleId: sale.saleId } };
  } catch (error) {
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para registrar una venta" };
    }
    if (error instanceof Error && error.message === "No hay suficientes pacas disponibles") {
      return { success: false, error: error.message };
    }
    console.error("Error creating sale:", error);
    return { success: false, error: "Error al registrar la venta" };
  }
}

async function deleteSaleInTx(
  tx: Prisma.TransactionClient,
  id: number,
  userId: number
): Promise<void> {
  const sale = await tx.pacaSale.findUnique({ where: { saleId: id } });
  if (!sale) {
    throw new Error("Venta no encontrada");
  }

  await tx.pacaSale.delete({ where: { saleId: id } });

  const updated = await tx.pacaInventory.updateMany({
    where: { categoryId: sale.categoryId, sold: { gte: sale.quantity } },
    data: {
      sold: { decrement: sale.quantity },
      available: { increment: sale.quantity },
      totalCost: { increment: sale.costOfGoods },
    },
  });
  if (updated.count !== 1) {
    throw new Error("No se pudo revertir la venta: inconsistencia de inventario");
  }

  await recordShadowMovement(tx, {
    categoryId: sale.categoryId,
    quantity: sale.quantity,
    unitCost: sale.quantity > 0 ? Number(sale.costOfGoods) / sale.quantity : 0,
    movementType: "entry",
    reference: `paca:reverso-venta #${sale.saleId}`,
    userId,
  });

  await createAuditLog(tx, {
    action: "delete",
    entityType: "PacaSale",
    entityId: id,
    module: "pacas",
    userId,
    oldValues: sale,
  });
}

export async function deleteSales(
  ids: number[]
): Promise<ActionResult<{ deleted: number }>> {
  try {
    if (!ids.length) return { success: true, data: { deleted: 0 } };
    const userId = await requireCurrentUserId();

    const deleted = await db.$transaction(async (tx) => {
      for (const id of ids) {
        try {
          await deleteSaleInTx(tx, id, userId);
        } catch (rowError) {
          const reason = rowError instanceof Error ? rowError.message : "error desconocido";
          throw new Error(`Fallo al eliminar la venta #${id}: ${reason}`);
        }
      }
      return ids.length;
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/ventas");
    revalidatePath("/pacas/disponibilidad");
    return { success: true, data: { deleted } };
  } catch (error) {
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para eliminar ventas" };
    }
    console.error("Error bulk delete sales:", error);
    const message = error instanceof Error ? error.message : "Error al eliminar ventas en lote";
    return { success: false, error: message };
  }
}

export async function deleteSale(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();

    await db.$transaction(async (tx) => {
      await deleteSaleInTx(tx, id, userId);
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/ventas");
    revalidatePath("/pacas/disponibilidad");
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para eliminar una venta" };
    }
    if (error instanceof Error && error.message === "Venta no encontrada") {
      return { success: false, error: error.message };
    }
    console.error("Error deleting sale:", error);
    return { success: false, error: "Error al eliminar la venta" };
  }
}
