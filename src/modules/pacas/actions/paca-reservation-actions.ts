"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

const INSUFFICIENT_STOCK = "No hay suficientes pacas disponibles";

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
    if (!Number.isInteger(data.quantity) || data.quantity < 1) {
      return { success: false, error: "La cantidad debe ser un entero mayor o igual a 1" };
    }

    const userId = await requireCurrentUserId();

    const reservation = await db.$transaction(async (tx) => {
      const updated = await tx.pacaInventory.updateMany({
        where: { categoryId: data.categoryId, available: { gte: data.quantity } },
        data: {
          available: { decrement: data.quantity },
          reserved: { increment: data.quantity },
        },
      });
      if (updated.count !== 1) {
        throw new Error(INSUFFICIENT_STOCK);
      }

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
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para crear una reservacion" };
    }
    if (error instanceof Error && error.message === INSUFFICIENT_STOCK) {
      return { success: false, error: error.message };
    }
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
    if (data.quantity !== undefined && (!Number.isInteger(data.quantity) || data.quantity < 1)) {
      return { success: false, error: "La cantidad debe ser un entero mayor o igual a 1" };
    }

    const userId = await requireCurrentUserId();

    await db.$transaction(async (tx) => {
      const reservation = await tx.pacaReservation.findUnique({ where: { reservationId: id } });
      if (!reservation || reservation.status !== "active") {
        throw new Error("La reservacion no esta activa");
      }

      const commonFields = {
        ...(data.clientId !== undefined && { clientId: data.clientId }),
        ...(data.clientName !== undefined && { clientName: data.clientName }),
        ...(data.clientPhone !== undefined && { clientPhone: data.clientPhone || null }),
        ...(data.clientEmail !== undefined && { clientEmail: data.clientEmail || null }),
        ...(data.reservationDate !== undefined && { reservationDate: data.reservationDate }),
        ...(data.expirationDate !== undefined && { expirationDate: data.expirationDate || null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
      };

      // Si cambia la cantidad, ajustar inventario de forma atomica
      if (data.quantity !== undefined && data.quantity !== reservation.quantity) {
        const diff = data.quantity - reservation.quantity;

        if (diff > 0) {
          const updated = await tx.pacaInventory.updateMany({
            where: { categoryId: reservation.categoryId, available: { gte: diff } },
            data: {
              available: { decrement: diff },
              reserved: { increment: diff },
            },
          });
          if (updated.count !== 1) {
            throw new Error(INSUFFICIENT_STOCK);
          }
        } else {
          // diff < 0: se libera stock, siempre seguro
          await tx.pacaInventory.update({
            where: { categoryId: reservation.categoryId },
            data: {
              available: { increment: -diff },
              reserved: { decrement: -diff },
            },
          });
        }

        await tx.pacaReservation.update({
          where: { reservationId: id },
          data: { ...commonFields, quantity: data.quantity },
        });
      } else {
        await tx.pacaReservation.update({
          where: { reservationId: id },
          data: commonFields,
        });
      }

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

    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para actualizar una reservacion" };
    }
    if (
      error instanceof Error &&
      (error.message === INSUFFICIENT_STOCK || error.message === "La reservacion no esta activa")
    ) {
      return { success: false, error: error.message };
    }
    console.error("Error updating reservation:", error);
    return { success: false, error: "Error al actualizar la reservacion" };
  }
}

export async function deleteReservations(
  ids: number[]
): Promise<ActionResult<{ deleted: number }>> {
  try {
    if (!ids.length) return { success: true, data: { deleted: 0 } };
    let deleted = 0;
    for (const id of ids) {
      const r = await deleteReservation(id);
      if (r.success) deleted++;
    }
    return { success: true, data: { deleted } };
  } catch (error) {
    console.error("Error bulk delete reservations:", error);
    return { success: false, error: "Error al eliminar reservaciones en lote" };
  }
}

export async function deleteReservation(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();

    await db.$transaction(async (tx) => {
      const reservation = await tx.pacaReservation.findUnique({ where: { reservationId: id } });
      if (!reservation) {
        throw new Error("Reservacion no encontrada");
      }

      // Si estaba activa, devolver al inventario
      if (reservation.status === "active") {
        const updated = await tx.pacaInventory.updateMany({
          where: { categoryId: reservation.categoryId, reserved: { gte: reservation.quantity } },
          data: {
            reserved: { decrement: reservation.quantity },
            available: { increment: reservation.quantity },
          },
        });
        if (updated.count !== 1) {
          throw new Error("No se pudo liberar el inventario: inconsistencia de reservado");
        }
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
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para eliminar una reservacion" };
    }
    if (error instanceof Error && error.message === "Reservacion no encontrada") {
      return { success: false, error: error.message };
    }
    console.error("Error deleting reservation:", error);
    return { success: false, error: "Error al eliminar la reservacion" };
  }
}

export async function cancelReservation(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();

    await db.$transaction(async (tx) => {
      const reservation = await tx.pacaReservation.findUnique({ where: { reservationId: id } });
      if (!reservation || reservation.status !== "active") {
        throw new Error("La reservacion no esta activa");
      }

      await tx.pacaReservation.update({
        where: { reservationId: id },
        data: { status: "cancelled" },
      });

      const updated = await tx.pacaInventory.updateMany({
        where: { categoryId: reservation.categoryId, reserved: { gte: reservation.quantity } },
        data: {
          reserved: { decrement: reservation.quantity },
          available: { increment: reservation.quantity },
        },
      });
      if (updated.count !== 1) {
        throw new Error("No se pudo liberar el inventario: inconsistencia de reservado");
      }

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
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para cancelar una reservacion" };
    }
    if (error instanceof Error && error.message === "La reservacion no esta activa") {
      return { success: false, error: error.message };
    }
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
    if (saleData.salePrice < 0) {
      return { success: false, error: "El precio de venta no puede ser negativo" };
    }

    const userId = await requireCurrentUserId();

    await db.$transaction(async (tx) => {
      const reservation = await tx.pacaReservation.findUnique({ where: { reservationId: id } });
      if (!reservation || reservation.status !== "active") {
        throw new Error("La reservacion no esta activa");
      }

      // avgCost se lee dentro de la tx, antes del updateMany atomico:
      // reserved solo baja via completeReservation/cancelReservation/deleteReservation,
      // todas dentro de tx, asi que el snapshot es consistente con la condicion
      // `reserved >= quantity` verificada a continuacion.
      const inventory = await tx.pacaInventory.findUnique({
        where: { categoryId: reservation.categoryId },
      });
      const totalInStock = (inventory?.available ?? 0) + (inventory?.reserved ?? 0);
      const avgCost = totalInStock > 0 ? Number(inventory?.totalCost ?? 0) / totalInStock : 0;
      const costToDeduct = avgCost * reservation.quantity;

      const updated = await tx.pacaInventory.updateMany({
        where: { categoryId: reservation.categoryId, reserved: { gte: reservation.quantity } },
        data: {
          reserved: { decrement: reservation.quantity },
          sold: { increment: reservation.quantity },
          totalCost: { decrement: costToDeduct },
        },
      });
      if (updated.count !== 1) {
        throw new Error("No se pudo completar: inconsistencia de reservado");
      }

      await tx.pacaReservation.update({
        where: { reservationId: id },
        data: { status: "completed" },
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
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para completar una reservacion" };
    }
    if (
      error instanceof Error &&
      (error.message === "La reservacion no esta activa" ||
        error.message === "No se pudo completar: inconsistencia de reservado")
    ) {
      return { success: false, error: error.message };
    }
    console.error("Error completing reservation:", error);
    return { success: false, error: "Error al completar la reservacion" };
  }
}
