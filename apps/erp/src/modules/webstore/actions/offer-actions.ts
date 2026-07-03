"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import { writeDiscountHistory } from "@/modules/inventory/lib/discount-history";
import { offerInputSchema, type OfferInput } from "../lib/offer-schemas";
import { syncOfferDiscounts, OfferConflictError } from "../lib/sync-offer-discounts";
import { getOfferHistory, type OfferHistoryRow } from "../queries/offer-queries";

const FORBIDDEN_ERROR_MESSAGE = "No tienes permisos para realizar esta acción";

function revalidateOfferSurfaces(): void {
  revalidatePath("/webstore/ofertas");
  revalidatePath("/webstore/catalogo");
  revalidatePath("/discounts");
}

function toOfferHeader(offerId: number, data: OfferInput, isActive: boolean) {
  return {
    offerId,
    name: data.name,
    type: data.type,
    value: data.value,
    startsAt: data.startsAt ? new Date(data.startsAt) : null,
    endsAt: data.endsAt ? new Date(data.endsAt) : null,
    isActive,
  };
}

export async function createOffer(
  input: OfferInput
): Promise<ActionResult<{ offerId: number }>> {
  const parsed = offerInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");

    const offer = await db.$transaction(async (tx) => {
      const created = await tx.webstoreOffer.create({
        data: {
          name: data.name,
          description: data.description ?? null,
          type: data.type,
          value: data.value,
          startsAt: data.startsAt ? new Date(data.startsAt) : null,
          endsAt: data.endsAt ? new Date(data.endsAt) : null,
          isActive: true,
          createdBy: userId,
        },
      });

      await syncOfferDiscounts(tx, toOfferHeader(created.offerId, data, true), data.productIds, userId);

      await createAuditLog(tx, {
        action: "create",
        entityType: "WebstoreOffer",
        entityId: created.offerId,
        module: "webstore",
        userId,
        newValues: data,
      });

      return created;
    });

    revalidateOfferSurfaces();
    return { success: true, data: { offerId: offer.offerId } };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    if (error instanceof OfferConflictError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    console.error("createOffer:", error);
    return { success: false, error: "Error al crear la oferta" };
  }
}

export async function updateOffer(
  offerId: number,
  input: OfferInput
): Promise<ActionResult<void>> {
  const parsed = offerInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");

    await db.$transaction(async (tx) => {
      const prev = await tx.webstoreOffer.findUnique({ where: { offerId } });
      if (!prev) throw new Error("NOT_FOUND");

      const updateData = {
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        value: data.value,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        version: { increment: 1 },
      };

      if (data.version !== undefined) {
        const res = await tx.webstoreOffer.updateMany({
          where: { offerId, version: data.version },
          data: updateData,
        });
        if (res.count === 0) throw new Error("STALE_VERSION");
      } else {
        await tx.webstoreOffer.update({ where: { offerId }, data: updateData });
      }

      await syncOfferDiscounts(
        tx,
        toOfferHeader(offerId, data, prev.isActive),
        data.productIds,
        userId
      );

      await createAuditLog(tx, {
        action: "update",
        entityType: "WebstoreOffer",
        entityId: offerId,
        module: "webstore",
        userId,
        oldValues: prev,
        newValues: data,
      });
    });

    revalidateOfferSurfaces();
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "STALE_VERSION") {
      return {
        success: false,
        error: "La oferta fue modificada por otra persona. Recarga e intenta de nuevo.",
      };
    }
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { success: false, error: "La oferta no existe o fue eliminada" };
    }
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    if (error instanceof OfferConflictError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    console.error("updateOffer:", error);
    return { success: false, error: "Error al actualizar la oferta" };
  }
}

export async function toggleOffer(offerId: number, isActive: boolean): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");

    await db.$transaction(async (tx) => {
      const offer = await tx.webstoreOffer.findUnique({
        where: { offerId },
        include: { discounts: true },
      });
      if (!offer) throw new Error("NOT_FOUND");

      await tx.webstoreOffer.update({
        where: { offerId },
        data: { isActive, version: { increment: 1 } },
      });

      const productIds = offer.discounts
        .map((d) => d.productId)
        .filter((id): id is number => id != null);

      await syncOfferDiscounts(
        tx,
        {
          offerId,
          name: offer.name,
          type: offer.type as "percent" | "fixed",
          value: Number(offer.value),
          startsAt: offer.startsAt,
          endsAt: offer.endsAt,
          isActive,
        },
        productIds,
        userId
      );

      await createAuditLog(tx, {
        action: "update",
        entityType: "WebstoreOffer",
        entityId: offerId,
        module: "webstore",
        userId,
        newValues: { isActive },
      });
    });

    revalidateOfferSurfaces();
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { success: false, error: "La oferta no existe o fue eliminada" };
    }
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    if (error instanceof OfferConflictError) {
      return { success: false, error: error.message };
    }
    console.error("toggleOffer:", error);
    return { success: false, error: "Error al cambiar el estado de la oferta" };
  }
}

export async function deleteOffer(offerId: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");

    await db.$transaction(async (tx) => {
      const offer = await tx.webstoreOffer.findUnique({
        where: { offerId },
        include: { discounts: true },
      });
      if (!offer) throw new Error("NOT_FOUND");

      for (const d of offer.discounts) {
        await tx.discount.delete({ where: { discountId: d.discountId } });
        await writeDiscountHistory(tx, {
          discountId: null,
          productId: d.productId,
          action: "deleted",
          oldValues: d,
          changedBy: userId,
        });
      }

      await tx.webstoreOffer.delete({ where: { offerId } });

      await createAuditLog(tx, {
        action: "delete",
        entityType: "WebstoreOffer",
        entityId: offerId,
        module: "webstore",
        userId,
        oldValues: offer,
      });
    });

    revalidateOfferSurfaces();
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { success: false, error: "La oferta no existe o fue eliminada" };
    }
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    console.error("deleteOffer:", error);
    return { success: false, error: "Error al eliminar la oferta" };
  }
}

export async function getOfferHistoryAction(offerId: number): Promise<ActionResult<OfferHistoryRow[]>> {
  try {
    await requireCurrentUserId();
    const rows = await getOfferHistory(offerId);
    return { success: true, data: rows };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    console.error("getOfferHistoryAction:", error);
    return { success: false, error: "No se pudo cargar el historial de la oferta." };
  }
}
