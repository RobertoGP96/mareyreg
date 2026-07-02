"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import {
  presentationCreateSchema,
  presentationUpdateSchema,
  type PresentationCreateInput,
  type PresentationUpdateInput,
} from "../lib/presentation-schemas";

const FORBIDDEN_ERROR_MESSAGE = "No tienes permisos para realizar esta acción";
const GENERIC_INVALID_MESSAGE = "Datos de presentación inválidos";

function revalidatePresentationSurfaces(): void {
  revalidatePath("/products");
  revalidatePath("/pos");
}

export async function createPresentation(
  productId: number,
  input: PresentationCreateInput
): Promise<ActionResult<{ presentationId: number }>> {
  try {
    const parsed = presentationCreateSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? GENERIC_INVALID_MESSAGE;
      return { success: false, error: message };
    }
    const data = parsed.data;

    const product = await db.product.findUnique({ where: { productId } });
    if (!product) {
      return { success: false, error: "El producto no existe" };
    }

    if (data.sku) {
      const [productHit, presentationHit] = await Promise.all([
        db.product.findUnique({ where: { sku: data.sku } }),
        db.productPresentation.findUnique({ where: { sku: data.sku } }),
      ]);
      if (productHit) {
        return { success: false, error: `Ya existe un producto con SKU ${data.sku}` };
      }
      if (presentationHit) {
        return { success: false, error: `Ya existe una presentación con SKU ${data.sku}` };
      }
    }

    if (data.barcode) {
      const [productHit, presentationHit] = await Promise.all([
        db.product.findUnique({ where: { barcode: data.barcode } }),
        db.productPresentation.findUnique({ where: { barcode: data.barcode } }),
      ]);
      if (productHit) {
        return { success: false, error: `Ya existe un producto con código de barras ${data.barcode}` };
      }
      if (presentationHit) {
        return { success: false, error: `Ya existe una presentación con código de barras ${data.barcode}` };
      }
    }

    const userId = await requireCurrentUserId();
    const presentation = await db.$transaction(async (tx) => {
      const p = await tx.productPresentation.create({
        data: {
          productId,
          name: data.name,
          factor: data.factor,
          sku: data.sku || null,
          barcode: data.barcode || null,
          retailPrice: data.retailPrice,
          wholesalePrice: data.wholesalePrice ?? null,
          isBase: false,
          isActive: true,
          sortOrder: data.sortOrder ?? 0,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "ProductPresentation",
        entityId: p.presentationId,
        module: "inventory",
        userId,
        newValues: data,
      });
      return p;
    });

    revalidatePresentationSurfaces();
    return { success: true, data: { presentationId: presentation.presentationId } };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    console.error("Error creating presentation:", error);
    return { success: false, error: "Error al crear la presentación" };
  }
}

export async function updatePresentation(
  presentationId: number,
  input: PresentationUpdateInput
): Promise<ActionResult<void>> {
  try {
    const parsed = presentationUpdateSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? GENERIC_INVALID_MESSAGE;
      return { success: false, error: message };
    }
    const data = parsed.data;

    const userId = await requireCurrentUserId();

    await db.$transaction(async (tx) => {
      const prev = await tx.productPresentation.findUnique({
        where: { presentationId },
        include: { product: true },
      });
      if (!prev) throw new Error("NOT_FOUND");

      if (data.sku !== undefined && data.sku && data.sku !== prev.sku) {
        const [productHit, presentationHit] = await Promise.all([
          tx.product.findUnique({ where: { sku: data.sku } }),
          tx.productPresentation.findUnique({ where: { sku: data.sku } }),
        ]);
        if (productHit) throw new Error(`SKU_COLLISION_PRODUCT:${data.sku}`);
        if (presentationHit && presentationHit.presentationId !== presentationId) {
          throw new Error(`SKU_COLLISION_PRESENTATION:${data.sku}`);
        }
      }

      if (data.barcode !== undefined && data.barcode && data.barcode !== prev.barcode) {
        const [productHit, presentationHit] = await Promise.all([
          tx.product.findUnique({ where: { barcode: data.barcode } }),
          tx.productPresentation.findUnique({ where: { barcode: data.barcode } }),
        ]);
        if (productHit) throw new Error(`BARCODE_COLLISION_PRODUCT:${data.barcode}`);
        if (presentationHit && presentationHit.presentationId !== presentationId) {
          throw new Error(`BARCODE_COLLISION_PRESENTATION:${data.barcode}`);
        }
      }

      const factorChanged = data.factor !== undefined && Number(prev.factor) !== data.factor;
      if (factorChanged) {
        const [invoiceLineCount, salesOrderLineCount] = await Promise.all([
          tx.invoiceLine.count({ where: { presentationId } }),
          tx.salesOrderLine.count({ where: { presentationId } }),
        ]);
        if (invoiceLineCount + salesOrderLineCount > 0) {
          throw new Error("FACTOR_LOCKED");
        }
      }

      const retailChanged =
        data.retailPrice !== undefined && Number(prev.retailPrice) !== data.retailPrice;
      // null se compara como null (no NaN) para que null -> null no cuente como cambio
      const prevWholesale = prev.wholesalePrice != null ? Number(prev.wholesalePrice) : null;
      const wholesaleChanged =
        data.wholesalePrice !== undefined && prevWholesale !== (data.wholesalePrice ?? null);
      const priceChanged = retailChanged || wholesaleChanged;

      if (priceChanged) {
        await assertRole("admin", "dispatcher");
      }

      await tx.productPresentation.update({
        where: { presentationId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(factorChanged && { factor: data.factor }),
          ...(data.sku !== undefined && { sku: data.sku || null }),
          ...(data.barcode !== undefined && { barcode: data.barcode || null }),
          ...(data.retailPrice !== undefined && { retailPrice: data.retailPrice }),
          ...(data.wholesalePrice !== undefined && { wholesalePrice: data.wholesalePrice ?? null }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        },
      });

      if (priceChanged) {
        await tx.presentationPriceHistory.create({
          data: {
            presentationId,
            oldRetailPrice: prev.retailPrice,
            newRetailPrice: data.retailPrice !== undefined ? data.retailPrice : prev.retailPrice,
            oldWholesalePrice: prev.wholesalePrice ?? null,
            newWholesalePrice:
              data.wholesalePrice !== undefined ? data.wholesalePrice : prev.wholesalePrice ?? null,
            changedBy: userId,
            reason: data.reason ?? null,
          },
        });
      }

      if (prev.isBase && retailChanged) {
        await tx.product.update({
          where: { productId: prev.productId },
          data: { salePrice: data.retailPrice },
        });
        await tx.productPriceHistory.create({
          data: {
            productId: prev.productId,
            oldCostPrice: prev.product.costPrice,
            newCostPrice: prev.product.costPrice,
            oldSalePrice: prev.product.salePrice,
            newSalePrice: data.retailPrice,
            changedBy: userId,
          },
        });
      }

      await createAuditLog(tx, {
        action: "update",
        entityType: "ProductPresentation",
        entityId: presentationId,
        module: "inventory",
        userId,
        oldValues: prev,
        newValues: data,
      });
    });

    revalidatePresentationSurfaces();
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { success: false, error: "La presentación no existe" };
    }
    if (error instanceof Error && error.message === "FACTOR_LOCKED") {
      return {
        success: false,
        error:
          "No se puede modificar el factor de una presentación con ventas registradas. Crea una nueva presentación en su lugar.",
      };
    }
    if (error instanceof Error && error.message.startsWith("SKU_COLLISION_PRODUCT:")) {
      return { success: false, error: `Ya existe un producto con SKU ${error.message.split(":")[1]}` };
    }
    if (error instanceof Error && error.message.startsWith("SKU_COLLISION_PRESENTATION:")) {
      return { success: false, error: `Ya existe una presentación con SKU ${error.message.split(":")[1]}` };
    }
    if (error instanceof Error && error.message.startsWith("BARCODE_COLLISION_PRODUCT:")) {
      return {
        success: false,
        error: `Ya existe un producto con código de barras ${error.message.split(":")[1]}`,
      };
    }
    if (error instanceof Error && error.message.startsWith("BARCODE_COLLISION_PRESENTATION:")) {
      return {
        success: false,
        error: `Ya existe una presentación con código de barras ${error.message.split(":")[1]}`,
      };
    }
    console.error("Error updating presentation:", error);
    return { success: false, error: "Error al actualizar la presentación" };
  }
}

export async function setPresentationActive(
  presentationId: number,
  isActive: boolean
): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();

    await db.$transaction(async (tx) => {
      const prev = await tx.productPresentation.findUnique({ where: { presentationId } });
      if (!prev) throw new Error("NOT_FOUND");
      if (prev.isBase && !isActive) throw new Error("BASE_LOCKED");

      await tx.productPresentation.update({
        where: { presentationId },
        data: { isActive },
      });

      await createAuditLog(tx, {
        action: "update",
        entityType: "ProductPresentation",
        entityId: presentationId,
        module: "inventory",
        userId,
        oldValues: { isActive: prev.isActive },
        newValues: { isActive },
      });
    });

    revalidatePresentationSurfaces();
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { success: false, error: "La presentación no existe" };
    }
    if (error instanceof Error && error.message === "BASE_LOCKED") {
      return { success: false, error: "No se puede desactivar la presentación base del producto" };
    }
    console.error("Error toggling presentation:", error);
    return { success: false, error: "Error al cambiar el estado de la presentación" };
  }
}

export async function deletePresentation(presentationId: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin");

    await db.$transaction(async (tx) => {
      const prev = await tx.productPresentation.findUnique({ where: { presentationId } });
      if (!prev) throw new Error("NOT_FOUND");
      if (prev.isBase) throw new Error("BASE_LOCKED");

      const [invoiceLineCount, salesOrderLineCount, priceHistoryCount] = await Promise.all([
        tx.invoiceLine.count({ where: { presentationId } }),
        tx.salesOrderLine.count({ where: { presentationId } }),
        tx.presentationPriceHistory.count({ where: { presentationId } }),
      ]);
      if (invoiceLineCount + salesOrderLineCount > 0) throw new Error("HAS_SALES");
      if (priceHistoryCount > 0) throw new Error("HAS_HISTORY");

      await tx.productPresentation.delete({ where: { presentationId } });

      await createAuditLog(tx, {
        action: "delete",
        entityType: "ProductPresentation",
        entityId: presentationId,
        module: "inventory",
        userId,
        oldValues: prev,
      });
    });

    revalidatePresentationSurfaces();
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { success: false, error: "La presentación no existe" };
    }
    if (error instanceof Error && error.message === "BASE_LOCKED") {
      return { success: false, error: "No se puede eliminar la presentación base del producto" };
    }
    if (error instanceof Error && error.message === "HAS_SALES") {
      return {
        success: false,
        error: "No se puede eliminar una presentación con ventas registradas. Desactívala en su lugar.",
      };
    }
    if (error instanceof Error && error.message === "HAS_HISTORY") {
      return {
        success: false,
        error: "No se puede eliminar una presentación con historial de precios. Desactívala en su lugar.",
      };
    }
    console.error("Error deleting presentation:", error);
    return { success: false, error: "Error al eliminar la presentación" };
  }
}

export interface PresentationPriceHistoryEntry {
  historyId: number;
  oldRetailPrice: number | null;
  newRetailPrice: number | null;
  oldWholesalePrice: number | null;
  newWholesalePrice: number | null;
  changedAt: string;
  changedByName: string | null;
  reason: string | null;
}

export async function getPresentationPriceHistoryAction(
  presentationId: number
): Promise<ActionResult<PresentationPriceHistoryEntry[]>> {
  try {
    const rows = await db.presentationPriceHistory.findMany({
      where: { presentationId },
      include: { changedByUser: { select: { fullName: true } } },
      orderBy: { changedAt: "desc" },
      take: 50,
    });
    return {
      success: true,
      data: rows.map((r) => ({
        historyId: r.historyId,
        oldRetailPrice: r.oldRetailPrice != null ? Number(r.oldRetailPrice) : null,
        newRetailPrice: r.newRetailPrice != null ? Number(r.newRetailPrice) : null,
        oldWholesalePrice: r.oldWholesalePrice != null ? Number(r.oldWholesalePrice) : null,
        newWholesalePrice: r.newWholesalePrice != null ? Number(r.newWholesalePrice) : null,
        changedAt: r.changedAt.toISOString(),
        changedByName: r.changedByUser?.fullName ?? null,
        reason: r.reason ?? null,
      })),
    };
  } catch (error) {
    console.error("Error fetching presentation price history:", error);
    return { success: false, error: "Error al obtener el historial de precios" };
  }
}
