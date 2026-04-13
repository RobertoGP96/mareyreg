"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

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
    const inventory = await db.pacaInventory.findUnique({
      where: { categoryId: data.categoryId },
    });

    if (!inventory || inventory.available < data.quantity) {
      return { success: false, error: `No hay suficiente stock disponible. Disponible: ${inventory?.available ?? 0}` };
    }

    // Calcular costo promedio por unidad para descontar del totalCost
    const totalInStock = inventory.available + inventory.reserved;
    const avgCost = totalInStock > 0 ? Number(inventory.totalCost) / totalInStock : 0;
    const costToDeduct = avgCost * data.quantity;

    const sale = await db.$transaction(async (tx) => {
      const s = await tx.pacaSale.create({
        data: {
          categoryId: data.categoryId,
          quantity: data.quantity,
          salePrice: data.salePrice,
          clientName: data.clientName,
          clientPhone: data.clientPhone || null,
          paymentMethod: data.paymentMethod || null,
          saleDate: data.saleDate,
          notes: data.notes || null,
        },
      });

      await tx.pacaInventory.update({
        where: { categoryId: data.categoryId },
        data: {
          available: { decrement: data.quantity },
          sold: { increment: data.quantity },
          totalCost: { decrement: costToDeduct },
        },
      });

      return s;
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/ventas");
    revalidatePath("/pacas/disponibilidad");
    return { success: true, data: { saleId: sale.saleId } };
  } catch (error) {
    console.error("Error creating sale:", error);
    return { success: false, error: "Error al registrar la venta" };
  }
}

export async function deleteSale(id: number): Promise<ActionResult<void>> {
  try {
    const sale = await db.pacaSale.findUnique({ where: { saleId: id } });
    if (!sale) {
      return { success: false, error: "Venta no encontrada" };
    }

    // Recalcular costo a devolver usando el precio de compra promedio historico
    // Como no tenemos el costo exacto, usamos 0 (no afecta el totalCost al revertir)
    await db.$transaction(async (tx) => {
      await tx.pacaSale.delete({ where: { saleId: id } });
      await tx.pacaInventory.update({
        where: { categoryId: sale.categoryId },
        data: {
          sold: { decrement: sale.quantity },
          available: { increment: sale.quantity },
        },
      });
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/ventas");
    revalidatePath("/pacas/disponibilidad");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting sale:", error);
    return { success: false, error: "Error al eliminar la venta" };
  }
}
