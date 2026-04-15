"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";

const revalidateAll = () => {
  revalidatePath("/pacas");
  revalidatePath("/pacas/reservaciones");
  revalidatePath("/pacas/ventas");
  revalidatePath("/pacas/disponibilidad");
};

export async function createReservation(data: {
  categoryId: number;
  quantity: number;
  clientId?: number;
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

    const userId = await getCurrentUserId();
    const reservation = await db.$transaction(async (tx) => {
      const res = await tx.pacaReservation.create({
        data: {
          categoryId: data.categoryId,
          clientId: data.clientId ?? null,
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

      await createAuditLog(tx, {
        action: "create",
        entityType: "PacaReservation",
        entityId: res.reservationId,
        module: "pacas",
        userId,
        newValues: data,
      });

      return res;
    });

    revalidateAll();
    return { success: true, data: { reservationId: reservation.reservationId } };
  } catch (error) {
    console.error("Error creating reservation:", error);
    return { success: false, error: "Error al crear la reservacion" };
  }
}

export async function updateReservation(
  id: number,
  data: {
    clientId?: number | null;
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    reservationDate?: string;
    expirationDate?: string;
    notes?: string;
    quantity?: number;
  }
): Promise<ActionResult<void>> {
  try {
    const reservation = await db.pacaReservation.findUnique({ where: { reservationId: id } });
    if (!reservation || reservation.status !== "active") {
      return { success: false, error: "La reservacion no esta activa" };
    }

    // Si cambia la cantidad, ajustar inventario
    if (data.quantity !== undefined && data.quantity !== reservation.quantity) {
      const diff = data.quantity - reservation.quantity;
      const inventory = await db.pacaInventory.findUnique({
        where: { categoryId: reservation.categoryId },
      });

      if (diff > 0 && (!inventory || inventory.available < diff)) {
        return { success: false, error: `No hay suficiente stock. Disponible: ${inventory?.available ?? 0}` };
      }

      const userId = await getCurrentUserId();
      await db.$transaction(async (tx) => {
        await tx.pacaReservation.update({
          where: { reservationId: id },
          data: {
            ...(data.clientId !== undefined && { clientId: data.clientId }),
            ...(data.clientName !== undefined && { clientName: data.clientName }),
            ...(data.clientPhone !== undefined && { clientPhone: data.clientPhone || null }),
            ...(data.clientEmail !== undefined && { clientEmail: data.clientEmail || null }),
            ...(data.reservationDate !== undefined && { reservationDate: data.reservationDate }),
            ...(data.expirationDate !== undefined && { expirationDate: data.expirationDate || null }),
            ...(data.notes !== undefined && { notes: data.notes || null }),
            quantity: data.quantity,
          },
        });

        await tx.pacaInventory.update({
          where: { categoryId: reservation.categoryId },
          data: {
            available: { decrement: diff },
            reserved: { increment: diff },
          },
        });

        await createAuditLog(tx, {
          action: "update",
          entityType: "PacaReservation",
          entityId: id,
          module: "pacas",
          userId,
          oldValues: reservation,
          newValues: data,
        });
      });
    } else {
      const userId = await getCurrentUserId();
      await db.$transaction(async (tx) => {
        await tx.pacaReservation.update({
          where: { reservationId: id },
          data: {
            ...(data.clientId !== undefined && { clientId: data.clientId }),
            ...(data.clientName !== undefined && { clientName: data.clientName }),
            ...(data.clientPhone !== undefined && { clientPhone: data.clientPhone || null }),
            ...(data.clientEmail !== undefined && { clientEmail: data.clientEmail || null }),
            ...(data.reservationDate !== undefined && { reservationDate: data.reservationDate }),
            ...(data.expirationDate !== undefined && { expirationDate: data.expirationDate || null }),
            ...(data.notes !== undefined && { notes: data.notes || null }),
          },
        });
        await createAuditLog(tx, {
          action: "update",
          entityType: "PacaReservation",
          entityId: id,
          module: "pacas",
          userId,
          oldValues: reservation,
          newValues: data,
        });
      });
    }

    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating reservation:", error);
    return { success: false, error: "Error al actualizar la reservacion" };
  }
}

export async function deleteReservation(id: number): Promise<ActionResult<void>> {
  try {
    const reservation = await db.pacaReservation.findUnique({ where: { reservationId: id } });
    if (!reservation) {
      return { success: false, error: "Reservacion no encontrada" };
    }

    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      // Si estaba activa, devolver al inventario
      if (reservation.status === "active") {
        await tx.pacaInventory.update({
          where: { categoryId: reservation.categoryId },
          data: {
            reserved: { decrement: reservation.quantity },
            available: { increment: reservation.quantity },
          },
        });
      }

      await tx.pacaReservation.delete({ where: { reservationId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "PacaReservation",
        entityId: id,
        module: "pacas",
        userId,
        oldValues: reservation,
      });
    });

    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting reservation:", error);
    return { success: false, error: "Error al eliminar la reservacion" };
  }
}

export async function cancelReservation(id: number): Promise<ActionResult<void>> {
  try {
    const reservation = await db.pacaReservation.findUnique({ where: { reservationId: id } });
    if (!reservation || reservation.status !== "active") {
      return { success: false, error: "La reservacion no esta activa" };
    }

    const userId = await getCurrentUserId();
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

      await createAuditLog(tx, {
        action: "cancel",
        entityType: "PacaReservation",
        entityId: id,
        module: "pacas",
        userId,
        oldValues: reservation,
      });
    });

    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    return { success: false, error: "Error al cancelar la reservacion" };
  }
}

// Completar reservacion CON datos de venta proporcionados por el usuario
export async function completeReservation(
  id: number,
  saleData: {
    salePrice: number;
    paymentMethod?: string;
    saleDate: string;
    notes?: string;
  }
): Promise<ActionResult<void>> {
  try {
    const reservation = await db.pacaReservation.findUnique({ where: { reservationId: id } });
    if (!reservation || reservation.status !== "active") {
      return { success: false, error: "La reservacion no esta activa" };
    }

    const inventory = await db.pacaInventory.findUnique({
      where: { categoryId: reservation.categoryId },
    });

    const totalInStock = (inventory?.available ?? 0) + (inventory?.reserved ?? 0);
    const avgCost = totalInStock > 0 ? Number(inventory?.totalCost ?? 0) / totalInStock : 0;
    const costToDeduct = avgCost * reservation.quantity;

    const userId = await getCurrentUserId();
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

      const sale = await tx.pacaSale.create({
        data: {
          categoryId: reservation.categoryId,
          clientId: reservation.clientId,
          quantity: reservation.quantity,
          salePrice: saleData.salePrice,
          clientName: reservation.clientName,
          clientPhone: reservation.clientPhone,
          paymentMethod: saleData.paymentMethod || null,
          saleDate: saleData.saleDate,
          notes: saleData.notes || `Venta desde reservacion #${reservation.reservationId}`,
        },
      });

      await createAuditLog(tx, {
        action: "complete",
        entityType: "PacaReservation",
        entityId: id,
        module: "pacas",
        userId,
        oldValues: reservation,
        newValues: { saleId: sale.saleId, ...saleData, costToDeduct },
      });
    });

    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error completing reservation:", error);
    return { success: false, error: "Error al completar la reservacion" };
  }
}
