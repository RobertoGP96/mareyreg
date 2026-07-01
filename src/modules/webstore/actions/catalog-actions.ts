"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import type { ActionResult } from "@/types";
import { updateProduct } from "@/modules/inventory/actions/product-actions";
import { updatePriceSchema, toggleFlagSchema } from "../lib/catalog-schemas";
import { getDiscountsByProduct, type ProductDiscountRow } from "../queries/catalog-queries";

const CATALOG_PATH = "/webstore/catalogo";

export async function toggleWebstoreEnabled(
  productId: number,
  value: boolean
): Promise<ActionResult<void>> {
  const parsed = toggleFlagSchema.safeParse({ productId, value });
  if (!parsed.success) return { success: false, error: "Datos inválidos" };
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { productId },
        data: { webstoreEnabled: value },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Product",
        entityId: productId,
        module: "webstore",
        userId,
        newValues: { webstoreEnabled: value },
      });
    });
    revalidatePath(CATALOG_PATH);
    return { success: true, data: undefined };
  } catch (e) {
    if (e instanceof Error && e.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción" };
    }
    console.error("toggleWebstoreEnabled:", e);
    return { success: false, error: "No se pudo actualizar la visibilidad del producto." };
  }
}

export async function toggleWebstoreFeatured(
  productId: number,
  value: boolean
): Promise<ActionResult<void>> {
  const parsed = toggleFlagSchema.safeParse({ productId, value });
  if (!parsed.success) return { success: false, error: "Datos inválidos" };
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { productId },
        data: { webstoreFeatured: value },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Product",
        entityId: productId,
        module: "webstore",
        userId,
        newValues: { webstoreFeatured: value },
      });
    });
    revalidatePath(CATALOG_PATH);
    return { success: true, data: undefined };
  } catch (e) {
    if (e instanceof Error && e.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción" };
    }
    console.error("toggleWebstoreFeatured:", e);
    return { success: false, error: "No se pudo actualizar la oferta destacada." };
  }
}

export async function updateWebstorePrice(
  productId: number,
  salePrice: number
): Promise<ActionResult<void>> {
  const parsed = updatePriceSchema.safeParse({ productId, salePrice });
  if (!parsed.success) return { success: false, error: "Precio inválido" };
  const res = await updateProduct(productId, { salePrice });
  if (res.success) revalidatePath(CATALOG_PATH);
  return res;
}

export async function getProductDiscountsAction(
  productId: number
): Promise<ActionResult<ProductDiscountRow[]>> {
  try {
    const rows = await getDiscountsByProduct(productId);
    return { success: true, data: rows };
  } catch (e) {
    console.error("getProductDiscountsAction:", e);
    return { success: false, error: "No se pudieron cargar los descuentos del producto." };
  }
}
