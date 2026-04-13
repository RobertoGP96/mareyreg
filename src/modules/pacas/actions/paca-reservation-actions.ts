"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function createReservation(data: {
  categoryId: number;
  quantity: number;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  reservationDate: string;
  expirationDate?: string;
  notes?: string;
}): Promise<ActionResult<{ reservationId: number }>> {
  try {
    const inventory = await db.pacaInventory.findUnique({
      where: { categoryId: data.categoryId },
    });

    if (!inventory || inventory.available < data.quantity) {
      return { success: false, error: `No hay suficiente stock disponible. Disponible: ${inventory?.available ?? 0}` };
    }

    const reservation = await db.$transaction(async (tx) => {
      const res = await tx.pacaReservation.create({
        data: {
          categoryId: data.categoryId,
          quantity: data.quantity,
          clientName: data.clientName,
          clientPhone: data.clientPhone || null,
          clientEmail: data.clientEmail || null,
          reservationDate: data.reservationDate,
          expirationDate: data.expirationDate || null,
          notes: data.notes || null,
        },
      });

      await tx.pacaInventory.update({
        where: { categoryId: data.categoryId },
        data: {
          available: { decrement: data.quantity },
          reserved: { increment: data.quantity },
        },
      });

      return res;
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/reservaciones");
    revalidatePath("/pacas/disponibilidad");
    return { success: true, data: { reservationId: reservation.reservationId } };
  } catch (error) {
    console.error("Error creating reservation:", error);
    return { success: false, error: "Error al crear la reservacion" };
  }
}

export async function cancelReservation(id: number): Promise<ActionResult<void>> {
  try {
    const reservation = await db.pacaReservation.findUnique({ where: { reservationId: id } });
    if (!reservation || reservation.status !== "active") {
      return { success: false, error: "La reservacion no esta activa" };
    }

    await db.$transaction(async (tx) => {
      await tx.pacaReservation.update({
        where: { reservationId: id },
        data: { status: "cancelled" },
      });

      await tx.pacaInventory.update({
        where: { categoryId: reservation.categoryId },
        data: {
          reserved: { decrement: reservation.quantity },
          available: { increment: reservation.quantity },
        },
      });
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/reservaciones");
    revalidatePath("/pacas/disponibilidad");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    return { success: false, error: "Error al cancelar la reservacion" };
  }
}

export async function completeReservation(id: number): Promise<ActionResult<void>> {
  try {
    const reservation = await db.pacaReservation.findUnique({ where: { reservationId: id } });
    if (!reservation || reservation.status !== "active") {
      return { success: false, error: "La reservacion no esta activa" };
    }

    const inventory = await db.pacaInventory.findUnique({
      where: { categoryId: reservation.categoryId },
    });

    // Calcular costo promedio para descontar
    const totalInStock = (inventory?.available ?? 0) + (inventory?.reserved ?? 0);
    const avgCost = totalInStock > 0 ? Number(inventory?.totalCost ?? 0) / totalInStock : 0;
    const costToDeduct = avgCost * reservation.quantity;

    await db.$transaction(async (tx) => {
      await tx.pacaReservation.update({
        where: { reservationId: id },
        data: { status: "completed" },
      });

      await tx.pacaInventory.update({
        where: { categoryId: reservation.categoryId },
        data: {
          reserved: { decrement: reservation.quantity },
          sold: { increment: reservation.quantity },
          totalCost: { decrement: costToDeduct },
        },
      });

      // Crear registro de venta automaticamente
      await tx.pacaSale.create({
        data: {
          categoryId: reservation.categoryId,
          quantity: reservation.quantity,
          salePrice: avgCost, // Precio de costo promedio como referencia
          clientName: reservation.clientName,
          clientPhone: reservation.clientPhone,
          paymentMethod: null,
          saleDate: new Date().toISOString().split("T")[0],
          notes: `Venta desde reservacion #${reservation.reservationId} - Actualizar precio de venta`,
        },
      });
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/reservaciones");
    revalidatePath("/pacas/ventas");
    revalidatePath("/pacas/disponibilidad");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error completing reservation:", error);
    return { success: false, error: "Error al completar la reservacion" };
  }
}
