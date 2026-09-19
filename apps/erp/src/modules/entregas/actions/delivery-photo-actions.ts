"use server";

import { db } from "@/lib/db";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import {
  deliveryPhotoMetaSchema,
  deliveryPhotosSchema,
  type DeliveryPhotoInput,
  type DeliveryPhotoMetaInput,
} from "../lib/schemas";
import { appendPhotos } from "../lib/delivery-photos";
import { deleteBlobsQuietly } from "../lib/blob";
import { revalidateDeliveries } from "../lib/revalidate";

const AUTH_ERROR_MESSAGE = "Debes iniciar sesión para realizar esta acción.";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

/** Agrega fotos a una entrega existente desde la página de detalle. */
export async function addDeliveryPhotos(
  deliveryId: number,
  input: DeliveryPhotoInput[]
): Promise<ActionResult<{ added: number }>> {
  try {
    const parsed = deliveryPhotosSchema.min(1, "Selecciona al menos una foto").safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Fotos inválidas" };
    }
    const userId = await requireCurrentUserId();

    const added = await db.$transaction(async (tx) => {
      const delivery = await tx.cashDelivery.findUnique({
        where: { deliveryId },
        select: { status: true },
      });
      if (!delivery) throw new Error("Entrega no encontrada");
      if (delivery.status === "cancelled") {
        throw new Error("No se pueden agregar fotos a una entrega cancelada");
      }
      const count = await appendPhotos(tx, deliveryId, parsed.data, userId);
      await createAuditLog(tx, {
        action: "photo_added",
        entityType: "CashDelivery",
        entityId: deliveryId,
        module: "entregas",
        userId,
        newValues: { photos: parsed.data },
      });
      return count;
    });

    revalidateDeliveries(deliveryId);
    return { success: true, data: { added } };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("addDeliveryPhotos:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al agregar las fotos",
    };
  }
}

export async function updateDeliveryPhoto(
  photoId: number,
  input: DeliveryPhotoMetaInput
): Promise<ActionResult<void>> {
  try {
    const parsed = deliveryPhotoMetaSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const userId = await requireCurrentUserId();

    const deliveryId = await db.$transaction(async (tx) => {
      const prev = await tx.cashDeliveryPhoto.findUnique({ where: { photoId } });
      if (!prev) throw new Error("Foto no encontrada");
      await tx.cashDeliveryPhoto.update({
        where: { photoId },
        data: { kind: parsed.data.kind, caption: parsed.data.caption?.trim() || null },
      });
      await createAuditLog(tx, {
        action: "photo_updated",
        entityType: "CashDeliveryPhoto",
        entityId: photoId,
        module: "entregas",
        userId,
        oldValues: { kind: prev.kind, caption: prev.caption },
        newValues: parsed.data,
      });
      return prev.deliveryId;
    });

    revalidateDeliveries(deliveryId);
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("updateDeliveryPhoto:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar la foto",
    };
  }
}

/** Solo quien subió la foto o un admin puede quitarla: es evidencia de la entrega. */
export async function removeDeliveryPhoto(photoId: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    let isAdmin = true;
    try {
      await assertRole("admin");
    } catch (error) {
      if (!(error instanceof ForbiddenError)) throw error;
      isAdmin = false;
    }

    const removed = await db.$transaction(async (tx) => {
      const prev = await tx.cashDeliveryPhoto.findUnique({ where: { photoId } });
      if (!prev) throw new Error("Foto no encontrada");
      if (!isAdmin && prev.uploadedById !== userId) {
        throw new Error("Solo quien subió la foto o un administrador puede quitarla");
      }
      await tx.cashDeliveryPhoto.delete({ where: { photoId } });
      await createAuditLog(tx, {
        action: "photo_removed",
        entityType: "CashDeliveryPhoto",
        entityId: photoId,
        module: "entregas",
        userId,
        oldValues: prev,
      });
      return prev;
    });

    await deleteBlobsQuietly([removed.url]);
    revalidateDeliveries(removed.deliveryId);
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("removeDeliveryPhoto:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al quitar la foto",
    };
  }
}
