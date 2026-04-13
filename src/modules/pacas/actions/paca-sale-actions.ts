"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function createSale(data: {
  pacaId: number;
  clientName: string;
  clientPhone?: string;
  saleDate: string;
  salePrice: number;
  paymentMethod?: string;
  notes?: string;
}): Promise<ActionResult<{ saleId: number }>> {
  try {
    const paca = await db.paca.findUnique({ where: { pacaId: data.pacaId } });
    if (!paca || (paca.status !== "available" && paca.status !== "reserved")) {
      return { success: false, error: "La paca no esta disponible para venta" };
    }

    const sale = await db.$transaction(async (tx) => {
      const s = await tx.pacaSale.create({
        data: {
          pacaId: data.pacaId,
          clientName: data.clientName,
          clientPhone: data.clientPhone || null,
          saleDate: data.saleDate,
          salePrice: data.salePrice,
          paymentMethod: data.paymentMethod || null,
          notes: data.notes || null,
        },
      });

      await tx.paca.update({
        where: { pacaId: data.pacaId },
        data: { status: "sold" },
      });

      // Complete any active reservations for this paca
      await tx.pacaReservation.updateMany({
        where: { pacaId: data.pacaId, status: "active" },
        data: { status: "completed" },
      });

      return s;
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/ventas");
    revalidatePath("/pacas/reservaciones");
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

    await db.$transaction(async (tx) => {
      await tx.pacaSale.delete({ where: { saleId: id } });
      await tx.paca.update({
        where: { pacaId: sale.pacaId },
        data: { status: "available" },
      });
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/ventas");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting sale:", error);
    return { success: false, error: "Error al eliminar la venta" };
  }
}
