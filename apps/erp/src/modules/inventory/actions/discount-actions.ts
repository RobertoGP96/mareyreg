"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import type { Prisma } from "@/generated/prisma";
import { getDiscountHistory, type DiscountHistoryRow } from "../queries/discount-queries";

const FORBIDDEN_ERROR_MESSAGE = "No tienes permisos para realizar esta acción";

type PrismaTx = Prisma.TransactionClient;

function revalidateDiscountSurfaces(): void {
  revalidatePath("/discounts");
  revalidatePath("/products");
  revalidatePath("/webstore/catalogo");
}

export interface DiscountInput {
  name: string;
  type: "percent" | "fixed" | "volume";
  value: number;
  minQty?: number;
  startsAt?: string;
  endsAt?: string;
  productId?: number;
  category?: string;
  customerId?: number;
  version?: number;
}

function validate(data: DiscountInput): string | null {
  if ((data.type === "percent" || data.type === "volume") && (data.value < 0 || data.value > 100)) {
    return "El porcentaje de descuento debe estar entre 0 y 100";
  }
  if (data.value < 0) return "El valor del descuento no puede ser negativo";
  if (data.type === "volume" && (data.minQty == null || data.minQty <= 0)) {
    return "Los descuentos por volumen requieren una cantidad mínima";
  }
  if (data.productId && data.category) {
    return "Un descuento aplica a un producto o a una categoría, no a ambos";
  }
  return null;
}

async function writeDiscountHistory(
  tx: PrismaTx,
  input: {
    discountId?: number | null;
    productId?: number | null;
    action: "created" | "updated" | "activated" | "deactivated" | "deleted";
    oldValues?: unknown;
    newValues?: unknown;
    changedBy: number;
  }
): Promise<void> {
  await tx.discountHistory.create({
    data: {
      discountId: input.discountId ?? null,
      productId: input.productId ?? null,
      action: input.action,
      oldValues: input.oldValues != null ? (JSON.parse(JSON.stringify(input.oldValues)) as Prisma.InputJsonValue) : undefined,
      newValues: input.newValues != null ? (JSON.parse(JSON.stringify(input.newValues)) as Prisma.InputJsonValue) : undefined,
      changedBy: input.changedBy,
    },
  });
}

export async function createDiscount(
  data: DiscountInput
): Promise<ActionResult<{ discountId: number }>> {
  try {
    const validationError = validate(data);
    if (validationError) return { success: false, error: validationError };

    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");
    const discount = await db.$transaction(async (tx) => {
      const d = await tx.discount.create({
        data: {
          name: data.name,
          type: data.type,
          value: data.value,
          minQty: data.minQty ?? null,
          startsAt: data.startsAt ? new Date(data.startsAt) : null,
          endsAt: data.endsAt ? new Date(data.endsAt) : null,
          productId: data.productId ?? null,
          category: data.category ?? null,
          customerId: data.customerId ?? null,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "Discount",
        entityId: d.discountId,
        module: "inventory",
        userId,
        newValues: data,
      });
      await writeDiscountHistory(tx, {
        discountId: d.discountId,
        productId: d.productId,
        action: "created",
        newValues: data,
        changedBy: userId,
      });
      return d;
    });

    revalidateDiscountSurfaces();
    return { success: true, data: { discountId: discount.discountId } };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    console.error("Error creating discount:", error);
    return { success: false, error: "Error al crear el descuento" };
  }
}

export async function updateDiscount(
  id: number,
  data: DiscountInput
): Promise<ActionResult<void>> {
  try {
    const validationError = validate(data);
    if (validationError) return { success: false, error: validationError };

    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");
    await db.$transaction(async (tx) => {
      const prev = await tx.discount.findUnique({ where: { discountId: id } });

      // Si el descuento sigue activo y se reasigna a otro producto, desactiva
      // primero a los hermanos activos del producto destino. Así nunca hay dos
      // descuentos activos simultáneos para el mismo producto (regla "1 activo").
      let siblingIds: number[] = [];
      if (prev?.isActive && data.productId != null) {
        const siblings = await tx.discount.findMany({
          where: {
            productId: data.productId,
            isActive: true,
            discountId: { not: id },
          },
          select: { discountId: true },
        });
        siblingIds = siblings.map((s) => s.discountId);

        if (siblingIds.length > 0) {
          await tx.discount.updateMany({
            where: { discountId: { in: siblingIds } },
            data: { isActive: false, version: { increment: 1 } },
          });
          for (const siblingId of siblingIds) {
            await writeDiscountHistory(tx, {
              discountId: siblingId,
              productId: data.productId,
              action: "deactivated",
              oldValues: { isActive: true },
              newValues: { isActive: false },
              changedBy: userId,
            });
          }
        }
      }

      // Reusa el `prev` ya obtenido arriba — NO vuelvas a hacer findUnique.
      const discountData = {
        name: data.name,
        type: data.type,
        value: data.value,
        minQty: data.minQty ?? null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        productId: data.productId ?? null,
        category: data.category ?? null,
        customerId: data.customerId ?? null,
        version: { increment: 1 },
      };

      if (data.version !== undefined) {
        const res = await tx.discount.updateMany({
          where: { discountId: id, version: data.version },
          data: discountData,
        });
        if (res.count === 0) throw new Error("STALE_VERSION");
      } else {
        await tx.discount.update({ where: { discountId: id }, data: discountData });
      }
      await createAuditLog(tx, {
        action: "update",
        entityType: "Discount",
        entityId: id,
        module: "inventory",
        userId,
        oldValues: prev,
        newValues: data,
      });
      await writeDiscountHistory(tx, {
        discountId: id,
        productId: data.productId ?? prev?.productId ?? null,
        action: "updated",
        oldValues: prev,
        newValues: data,
        changedBy: userId,
      });
    });

    revalidateDiscountSurfaces();
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "STALE_VERSION") {
      return { success: false, error: "El descuento fue modificado por otra persona. Recarga e intenta de nuevo." };
    }
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    console.error("Error updating discount:", error);
    return { success: false, error: "Error al actualizar el descuento" };
  }
}

/**
 * Activa un descuento y desactiva los demás descuentos activos del mismo
 * producto (regla "solo un descuento activo a la vez"). El índice parcial
 * `discount_one_active_per_product` (prisma/sql/inventory-discounts.sql) es
 * la red de seguridad a nivel BD ante condiciones de carrera.
 */
export async function activateDiscount(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");

    await db.$transaction(async (tx) => {
      const target = await tx.discount.findUnique({ where: { discountId: id } });
      if (!target) throw new Error("NOT_FOUND");

      let siblingIds: number[] = [];
      if (target.productId != null) {
        const siblings = await tx.discount.findMany({
          where: {
            productId: target.productId,
            isActive: true,
            discountId: { not: id },
          },
          select: { discountId: true },
        });
        siblingIds = siblings.map((s) => s.discountId);

        if (siblingIds.length > 0) {
          await tx.discount.updateMany({
            where: { discountId: { in: siblingIds } },
            data: { isActive: false, version: { increment: 1 } },
          });
        }
      }

      await tx.discount.update({
        where: { discountId: id },
        data: { isActive: true, version: { increment: 1 } },
      });

      await writeDiscountHistory(tx, {
        discountId: id,
        productId: target.productId,
        action: "activated",
        oldValues: { isActive: target.isActive },
        newValues: { isActive: true },
        changedBy: userId,
      });
      for (const siblingId of siblingIds) {
        await writeDiscountHistory(tx, {
          discountId: siblingId,
          productId: target.productId,
          action: "deactivated",
          oldValues: { isActive: true },
          newValues: { isActive: false },
          changedBy: userId,
        });
      }

      await createAuditLog(tx, {
        action: "update",
        entityType: "Discount",
        entityId: id,
        module: "inventory",
        userId,
        newValues: { isActive: true, deactivatedSiblings: siblingIds },
      });
    });

    revalidateDiscountSurfaces();
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { success: false, error: "El descuento no existe o fue eliminado" };
    }
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    console.error("Error activating discount:", error);
    return { success: false, error: "Error al activar el descuento" };
  }
}

export async function toggleDiscount(id: number, isActive: boolean): Promise<ActionResult<void>> {
  try {
    if (isActive) {
      return await activateDiscount(id);
    }

    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");
    await db.$transaction(async (tx) => {
      const prev = await tx.discount.findUnique({ where: { discountId: id } });
      await tx.discount.update({ where: { discountId: id }, data: { isActive: false } });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Discount",
        entityId: id,
        module: "inventory",
        userId,
        newValues: { isActive: false },
      });
      await writeDiscountHistory(tx, {
        discountId: id,
        productId: prev?.productId ?? null,
        action: "deactivated",
        oldValues: { isActive: prev?.isActive ?? true },
        newValues: { isActive: false },
        changedBy: userId,
      });
    });
    revalidateDiscountSurfaces();
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    console.error("Error toggling discount:", error);
    return { success: false, error: "Error al cambiar el estado del descuento" };
  }
}

export async function deleteDiscount(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");
    await db.$transaction(async (tx) => {
      const prev = await tx.discount.findUnique({ where: { discountId: id } });
      await tx.discount.delete({ where: { discountId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "Discount",
        entityId: id,
        module: "inventory",
        userId,
        oldValues: prev,
      });
      await writeDiscountHistory(tx, {
        discountId: null,
        productId: prev?.productId ?? null,
        action: "deleted",
        oldValues: prev,
        changedBy: userId,
      });
    });
    revalidateDiscountSurfaces();
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    console.error("Error deleting discount:", error);
    return { success: false, error: "Error al eliminar el descuento" };
  }
}

export async function getDiscountHistoryAction(
  productId: number
): Promise<ActionResult<DiscountHistoryRow[]>> {
  try {
    await requireCurrentUserId();
    const rows = await getDiscountHistory(productId);
    return { success: true, data: rows };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    console.error("Error getting discount history:", error);
    return { success: false, error: "No se pudo cargar el historial de descuentos." };
  }
}
