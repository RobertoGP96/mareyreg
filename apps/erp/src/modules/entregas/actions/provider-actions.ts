"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { deliveryProviderSchema, type DeliveryProviderInput } from "../lib/schemas";

const AUTH_ERROR_MESSAGE = "Debes iniciar sesión para realizar esta acción.";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

const revalidateProviders = () => {
  revalidatePath("/entregas/proveedores");
  revalidatePath("/entregas");
};

export async function createDeliveryProvider(
  input: DeliveryProviderInput
): Promise<ActionResult<{ providerId: number }>> {
  try {
    const parsed = deliveryProviderSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;
    const userId = await requireCurrentUserId();

    const created = await db.$transaction(async (tx) => {
      const p = await tx.deliveryProvider.create({
        data: { name: data.name, active: data.active ?? true },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "DeliveryProvider",
        entityId: p.providerId,
        module: "entregas",
        userId,
        newValues: data,
      });
      return p;
    });

    revalidateProviders();
    return { success: true, data: { providerId: created.providerId } };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("createDeliveryProvider:", error);
    return { success: false, error: "Error al crear el proveedor" };
  }
}

export async function updateDeliveryProvider(
  id: number,
  input: DeliveryProviderInput
): Promise<ActionResult<void>> {
  try {
    const parsed = deliveryProviderSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;
    const userId = await requireCurrentUserId();

    await db.$transaction(async (tx) => {
      const prev = await tx.deliveryProvider.findUnique({ where: { providerId: id } });
      if (!prev) throw new Error("Proveedor no encontrado");
      await tx.deliveryProvider.update({
        where: { providerId: id },
        data: {
          name: data.name,
          ...(data.active !== undefined && { active: data.active }),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "DeliveryProvider",
        entityId: id,
        module: "entregas",
        userId,
        oldValues: prev,
        newValues: data,
      });
    });

    revalidateProviders();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("updateDeliveryProvider:", error);
    return { success: false, error: "Error al actualizar el proveedor" };
  }
}

export async function toggleDeliveryProviderActive(
  id: number
): Promise<ActionResult<{ active: boolean }>> {
  try {
    const userId = await requireCurrentUserId();
    const next = await db.$transaction(async (tx) => {
      const prev = await tx.deliveryProvider.findUnique({ where: { providerId: id } });
      if (!prev) throw new Error("Proveedor no encontrado");
      const updated = await tx.deliveryProvider.update({
        where: { providerId: id },
        data: { active: !prev.active },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "DeliveryProvider",
        entityId: id,
        module: "entregas",
        userId,
        oldValues: { active: prev.active },
        newValues: { active: updated.active },
      });
      return updated.active;
    });
    revalidateProviders();
    return { success: true, data: { active: next } };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("toggleDeliveryProviderActive:", error);
    return { success: false, error: "Error al cambiar el estado" };
  }
}

export async function deleteDeliveryProvider(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      const linked = await tx.cashDelivery.count({ where: { providerId: id } });
      if (linked > 0) {
        throw new Error(
          `No se puede eliminar: ${linked} entrega(s) registradas. Desactívalo en su lugar.`
        );
      }
      const prev = await tx.deliveryProvider.findUnique({ where: { providerId: id } });
      if (!prev) throw new Error("Proveedor no encontrado");
      await tx.deliveryProvider.delete({ where: { providerId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "DeliveryProvider",
        entityId: id,
        module: "entregas",
        userId,
        oldValues: prev,
      });
    });
    revalidateProviders();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("deleteDeliveryProvider:", error);
    const message = error instanceof Error ? error.message : "";
    return {
      success: false,
      error: message.startsWith("No se puede eliminar") ? message : "Error al eliminar el proveedor",
    };
  }
}
