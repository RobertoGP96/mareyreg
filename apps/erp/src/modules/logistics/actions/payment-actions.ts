"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { PaymentStatus } from "@/generated/prisma";

export type PaymentInput = {
  trip_id: number;
  amount: number;
  payment_date?: string | null;
  payment_method?: string | null;
  status?: PaymentStatus;
  notes?: string | null;
};

export async function createPayment(data: PaymentInput): Promise<ActionResult<{ payment_id: number }>> {
  try {
    if (!data.amount || data.amount <= 0) {
      return { success: false, error: "El monto debe ser mayor a cero" };
    }
    const p = await db.payment.create({
      data: {
        tripId: data.trip_id,
        amount: data.amount,
        paymentDate: data.payment_date ?? null,
        paymentMethod: data.payment_method ?? null,
        status: data.status ?? "pending",
        notes: data.notes ?? null,
      },
    });
    revalidatePath(`/trips/${data.trip_id}`);
    return { success: true, data: { payment_id: p.paymentId } };
  } catch (error) {
    console.error("Error creating payment:", error);
    return { success: false, error: "Error al registrar pago" };
  }
}

export async function updatePaymentStatus(
  id: number,
  tripId: number,
  status: PaymentStatus
): Promise<ActionResult<void>> {
  try {
    await db.payment.update({ where: { paymentId: id }, data: { status } });
    revalidatePath(`/trips/${tripId}`);
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating payment:", error);
    return { success: false, error: "Error al actualizar el pago" };
  }
}

export async function deletePayment(id: number, tripId: number): Promise<ActionResult<void>> {
  try {
    await db.payment.delete({ where: { paymentId: id } });
    revalidatePath(`/trips/${tripId}`);
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting payment:", error);
    return { success: false, error: "Error al eliminar pago" };
  }
}
