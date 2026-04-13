"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function createReservation(data: {
  pacaId: number;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  reservationDate: string;
  expirationDate?: string;
  notes?: string;
}): Promise<ActionResult<{ reservationId: number }>> {
  try {
    const paca = await db.paca.findUnique({ where: { pacaId: data.pacaId } });
    if (!paca || paca.status !== "available") {
      return { success: false, error: "La paca no esta disponible para reservar" };
    }

    const reservation = await db.$transaction(async (tx) => {
      const res = await tx.pacaReservation.create({
        data: {
          pacaId: data.pacaId,
          clientName: data.clientName,
          clientPhone: data.clientPhone || null,
          clientEmail: data.clientEmail || null,
          reservationDate: data.reservationDate,
          expirationDate: data.expirationDate || null,
          notes: data.notes || null,
        },
      });

      await tx.paca.update({
        where: { pacaId: data.pacaId },
        data: { status: "reserved" },
      });

      return res;
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/reservaciones");
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

      await tx.paca.update({
        where: { pacaId: reservation.pacaId },
        data: { status: "available" },
      });
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/reservaciones");
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

    await db.$transaction(async (tx) => {
      await tx.pacaReservation.update({
        where: { reservationId: id },
        data: { status: "completed" },
      });

      await tx.paca.update({
        where: { pacaId: reservation.pacaId },
        data: { status: "sold" },
      });
    });

    revalidatePath("/pacas");
    revalidatePath("/pacas/reservaciones");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error completing reservation:", error);
    return { success: false, error: "Error al completar la reservacion" };
  }
}
