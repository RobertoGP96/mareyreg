"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { courierProfileSchema, type CourierProfileInput } from "../lib/schemas";

const AUTH_ERROR_MESSAGE = "Debes iniciar sesión para realizar esta acción.";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

const revalidateCouriers = () => {
  revalidatePath("/envios/mensajeros");
  revalidatePath("/envios/entregas");
};

function commissionData(data: CourierProfileInput) {
  const commission = data.defaultCommission ?? null;
  return {
    phone: data.phone?.trim() || null,
    notes: data.notes?.trim() || null,
    defaultCommission: commission === null ? null : commission.toString(),
    defaultCommissionCurrencyId:
      commission === null || commission === 0 ? null : (data.defaultCommissionCurrencyId ?? null),
  };
}

export async function createCourierProfile(
  input: CourierProfileInput
): Promise<ActionResult<{ courierProfileId: number }>> {
  try {
    const parsed = courierProfileSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;
    const userId = await requireCurrentUserId();

    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { userId: data.userId },
        select: { userId: true },
      });
      if (!user) throw new Error("Usuario no encontrado");

      const existing = await tx.courierProfile.findUnique({
        where: { userId: data.userId },
        select: { courierProfileId: true },
      });
      if (existing) throw new Error("Ese usuario ya está registrado como mensajero");

      const profile = await tx.courierProfile.create({
        data: {
          userId: data.userId,
          ...commissionData(data),
          active: data.active ?? true,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "CourierProfile",
        entityId: profile.courierProfileId,
        module: "envios",
        userId,
        newValues: data,
      });
      return profile;
    });

    revalidateCouriers();
    return { success: true, data: { courierProfileId: created.courierProfileId } };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("createCourierProfile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al registrar el mensajero",
    };
  }
}

export async function updateCourierProfile(
  id: number,
  input: CourierProfileInput
): Promise<ActionResult<void>> {
  try {
    const parsed = courierProfileSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;
    const userId = await requireCurrentUserId();

    await db.$transaction(async (tx) => {
      const prev = await tx.courierProfile.findUnique({ where: { courierProfileId: id } });
      if (!prev) throw new Error("Mensajero no encontrado");

      const claimed = await tx.courierProfile.updateMany({
        where: { courierProfileId: id, version: prev.version },
        data: {
          ...commissionData(data),
          ...(data.active !== undefined && { active: data.active }),
          version: { increment: 1 },
        },
      });
      if (claimed.count === 0) {
        throw new Error("El mensajero cambió mientras lo editabas. Recarga e intenta de nuevo.");
      }

      await createAuditLog(tx, {
        action: "update",
        entityType: "CourierProfile",
        entityId: id,
        module: "envios",
        userId,
        oldValues: prev,
        newValues: data,
      });
    });

    revalidateCouriers();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("updateCourierProfile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar el mensajero",
    };
  }
}

export async function toggleCourierActive(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.courierProfile.findUnique({ where: { courierProfileId: id } });
      if (!prev) throw new Error("Mensajero no encontrado");

      await tx.courierProfile.update({
        where: { courierProfileId: id },
        data: { active: !prev.active, version: { increment: 1 } },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "CourierProfile",
        entityId: id,
        module: "envios",
        userId,
        oldValues: { active: prev.active },
        newValues: { active: !prev.active },
      });
    });
    revalidateCouriers();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("toggleCourierActive:", error);
    return { success: false, error: "Error al cambiar el estado del mensajero" };
  }
}

export async function deleteCourierProfile(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.courierProfile.findUnique({ where: { courierProfileId: id } });
      if (!prev) throw new Error("Mensajero no encontrado");

      const deliveries = await tx.cashDelivery.count({ where: { courierId: id } });
      if (deliveries > 0) {
        throw new Error(
          `El mensajero tiene ${deliveries} entrega(s) registradas. Desactívalo en lugar de eliminarlo.`
        );
      }

      await tx.courierProfile.delete({ where: { courierProfileId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "CourierProfile",
        entityId: id,
        module: "envios",
        userId,
        oldValues: prev,
      });
    });
    revalidateCouriers();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("deleteCourierProfile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al eliminar el mensajero",
    };
  }
}
