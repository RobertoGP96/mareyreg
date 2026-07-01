"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";

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
  stackable?: boolean;
  version?: number;
}

function validate(data: DiscountInput): string | null {
  if ((data.type === "percent" || data.type === "volume") && (data.value < 0 || data.value > 100)) {
    return "El porcentaje de descuento debe estar entre 0 y 100";
  }
  if (data.value < 0) return "El valor del descuento no puede ser negativo";
  if (data.type === "volume" && !data.minQty) {
    return "Los descuentos por volumen requieren una cantidad mínima";
  }
  if (data.productId && data.category) {
    return "Un descuento aplica a un producto o a una categoría, no a ambos";
  }
  return null;
}

export async function createDiscount(
  data: DiscountInput
): Promise<ActionResult<{ discountId: number }>> {
  try {
    const validationError = validate(data);
    if (validationError) return { success: false, error: validationError };

    const userId = await getCurrentUserId();
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
          stackable: data.stackable ?? false,
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
      return d;
    });

    revalidatePath("/discounts");
    return { success: true, data: { discountId: discount.discountId } };
  } catch (error) {
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

    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.discount.findUnique({ where: { discountId: id } });

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
        stackable: data.stackable ?? false,
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
    });

    revalidatePath("/discounts");
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "STALE_VERSION") {
      return { success: false, error: "El descuento fue modificado por otra persona. Recarga e intenta de nuevo." };
    }
    console.error("Error updating discount:", error);
    return { success: false, error: "Error al actualizar el descuento" };
  }
}

export async function toggleDiscount(id: number, isActive: boolean): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      await tx.discount.update({ where: { discountId: id }, data: { isActive } });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Discount",
        entityId: id,
        module: "inventory",
        userId,
        newValues: { isActive },
      });
    });
    revalidatePath("/discounts");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error toggling discount:", error);
    return { success: false, error: "Error al cambiar el estado del descuento" };
  }
}

export async function deleteDiscount(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
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
    });
    revalidatePath("/discounts");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting discount:", error);
    return { success: false, error: "Error al eliminar el descuento" };
  }
}
