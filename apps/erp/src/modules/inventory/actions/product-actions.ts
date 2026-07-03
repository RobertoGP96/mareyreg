"use server";

import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import { computeMarginInfo, safePriceMarginData, type PriceMarginData } from "../lib/margin";
import { getBaseCurrency, getRateToBase, GlobalRateNotConfiguredError } from "@/lib/currency";

const FORBIDDEN_ERROR_MESSAGE = "No tienes permisos para realizar esta acción";

/**
 * Best-effort: la foto ya no se referencia en DB, así que un fallo aquí solo
 * deja un blob huérfano (no debe tumbar la mutación que ya se commiteó).
 */
async function deleteProductImageBlob(url: string): Promise<void> {
  if (!url.includes(".blob.vercel-storage.com/")) return;
  try {
    await del(url);
  } catch (error) {
    console.error("No se pudo borrar el blob de la foto de producto:", url, error);
  }
}

export async function createProduct(data: {
  name: string;
  sku?: string;
  barcode?: string;
  category?: string;
  unit: string;
  minStock?: number;
  maxStock?: number;
  costPrice?: number;
  salePrice?: number;
  /** null/undefined = moneda base (CUP). Aplica a salePrice y a la presentación base. */
  saleCurrencyId?: number | null;
  secondaryPrice?: number;
  valuationMethod?: "fifo" | "average";
  tracksLots?: boolean;
  allowNegative?: boolean;
  webstoreEnabled?: boolean;
  imageUrl?: string;
  supplierId?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  isService?: boolean;
  /** Producto de peso variable (ej. queso): fuerza unit="kg" y allowNegative=false. */
  isCatchWeight?: boolean;
  brand?: string;
  supplier?: string;
  supplierRef?: string;
  description?: string;
  notes?: string;
}): Promise<ActionResult<{ productId: number } & PriceMarginData>> {
  try {
    if (data.isCatchWeight && data.unit !== "kg") {
      return { success: false, error: "Los productos de peso variable deben usar la unidad kg" };
    }
    if (data.isCatchWeight && data.allowNegative) {
      return {
        success: false,
        error: "Los productos de peso variable no permiten stock negativo",
      };
    }

    if (data.sku) {
      const existing = await db.product.findUnique({ where: { sku: data.sku } });
      if (existing) {
        return { success: false, error: `Ya existe un producto con SKU ${data.sku}` };
      }
    }

    if (data.barcode) {
      const existing = await db.product.findUnique({ where: { barcode: data.barcode } });
      if (existing) {
        return { success: false, error: `Ya existe un producto con codigo de barras ${data.barcode}` };
      }
    }

    const userId = await requireCurrentUserId();
    const product = await db.$transaction(async (tx) => {
      // Un precio en moneda sin tasa configurada dejaría el producto
      // invendible (effective-price lanza al cotizar): rechazar aquí con
      // el mensaje accionable de GlobalRateNotConfiguredError.
      if (data.saleCurrencyId != null) {
        await getRateToBase(tx, data.saleCurrencyId);
      }
      const p = await tx.product.create({
        data: {
          name: data.name,
          sku: data.sku || null,
          barcode: data.barcode || null,
          category: data.category || null,
          unit: data.unit,
          minStock: data.minStock ?? 0,
          maxStock: data.maxStock ?? null,
          costPrice: data.costPrice ?? null,
          salePrice: data.salePrice ?? null,
          saleCurrencyId: data.saleCurrencyId ?? null,
          secondaryPrice: data.secondaryPrice ?? null,
          valuationMethod: data.valuationMethod ?? "average",
          tracksLots: data.tracksLots ?? false,
          allowNegative: data.allowNegative ?? false,
          webstoreEnabled: data.webstoreEnabled ?? false,
          imageUrl: data.imageUrl || null,
          supplierId: data.supplierId ?? null,
          reorderPoint: data.reorderPoint ?? null,
          reorderQuantity: data.reorderQuantity ?? null,
          isService: data.isService ?? false,
          isCatchWeight: data.isCatchWeight ?? false,
          brand: data.brand || null,
          supplier: data.supplier || null,
          supplierRef: data.supplierRef || null,
          description: data.description || null,
          notes: data.notes || null,
        },
      });
      await tx.productPresentation.create({
        data: {
          productId: p.productId,
          name: data.unit,
          factor: 1,
          retailPrice: data.salePrice ?? 0,
          wholesalePrice: data.secondaryPrice ?? null,
          priceCurrencyId: data.saleCurrencyId ?? null,
          isBase: true,
          isActive: true,
          sortOrder: 0,
        },
      });

      await createAuditLog(tx, {
        action: "create",
        entityType: "Product",
        entityId: p.productId,
        module: "inventory",
        userId,
        newValues: data,
      });
      return p;
    });

    const margin =
      data.salePrice != null
        ? await safePriceMarginData(db, {
            productId: product.productId,
            priceAmount: data.salePrice,
            priceCurrencyId: data.saleCurrencyId ?? null,
          })
        : { marginWarning: null, replacementMarginPct: null, marginPct: null };

    revalidatePath("/products");
    return { success: true, data: { productId: product.productId, ...margin } };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    if (error instanceof GlobalRateNotConfiguredError) {
      return { success: false, error: error.message };
    }
    console.error("Error creating product:", error);
    return { success: false, error: "Error al crear el producto" };
  }
}

export async function updateProduct(
  id: number,
  data: {
    name?: string;
    sku?: string;
    barcode?: string;
    category?: string;
    unit?: string;
    minStock?: number;
    maxStock?: number;
    costPrice?: number;
    salePrice?: number;
    /** null = moneda base (CUP); undefined = sin cambio. */
    saleCurrencyId?: number | null;
    secondaryPrice?: number;
    valuationMethod?: "fifo" | "average";
    tracksLots?: boolean;
    allowNegative?: boolean;
    webstoreEnabled?: boolean;
    imageUrl?: string;
    supplierId?: number | null;
    reorderPoint?: number;
    reorderQuantity?: number;
    isService?: boolean;
    /** Producto de peso variable (ej. queso): fuerza unit="kg" y allowNegative=false. */
    isCatchWeight?: boolean;
    brand?: string;
    supplier?: string;
    supplierRef?: string;
    description?: string;
    notes?: string;
    isActive?: boolean;
  }
): Promise<ActionResult<PriceMarginData>> {
  try {
    const userId = await requireCurrentUserId();

    const effectiveUnit = data.unit;
    const effectiveIsCatchWeight = data.isCatchWeight;
    if (effectiveIsCatchWeight === true) {
      // Si unit no viene en este update, se valida contra el valor ya
      // guardado dentro de la transacción (ver chequeo con prev más abajo).
      if (effectiveUnit !== undefined && effectiveUnit !== "kg") {
        return { success: false, error: "Los productos de peso variable deben usar la unidad kg" };
      }
      if (data.allowNegative === true) {
        return {
          success: false,
          error: "Los productos de peso variable no permiten stock negativo",
        };
      }
    }

    const { previousImageUrl, marginInput } = await db.$transaction(async (tx) => {
      const prev = await tx.product.findUnique({ where: { productId: id } });

      const willBeCatchWeight = data.isCatchWeight !== undefined ? data.isCatchWeight : prev?.isCatchWeight ?? false;
      const willBeUnit = data.unit !== undefined ? data.unit : prev?.unit;
      if (willBeCatchWeight && willBeUnit !== "kg") {
        throw new Error("CATCH_WEIGHT_REQUIRES_KG");
      }
      const willAllowNegative =
        data.allowNegative !== undefined ? data.allowNegative : prev?.allowNegative ?? false;
      if (willBeCatchWeight && willAllowNegative) {
        throw new Error("CATCH_WEIGHT_FORBIDS_NEGATIVE");
      }

      // Desactivar peso variable con movimientos que ya registraron piezas
      // dejaría esas piezas huérfanas (sin significado en un producto
      // normal) — se bloquea el cambio.
      if (prev?.isCatchWeight && data.isCatchWeight === false) {
        const pieceMovementsCount = await tx.stockMovement.count({
          where: { productId: id, pieces: { not: null } },
        });
        if (pieceMovementsCount > 0) {
          throw new Error("CATCH_WEIGHT_HAS_PIECE_MOVEMENTS");
        }
      }

      const currencyChanged =
        data.saleCurrencyId !== undefined &&
        (prev?.saleCurrencyId ?? null) !== (data.saleCurrencyId ?? null);
      // secondaryPrice deprecado: ver ProductPresentation.wholesalePrice.
      // Cambiar la moneda cambia el precio efectivo aunque el número no cambie.
      const priceChanged =
        (data.costPrice !== undefined && Number(prev?.costPrice ?? NaN) !== data.costPrice) ||
        (data.salePrice !== undefined && Number(prev?.salePrice ?? NaN) !== data.salePrice) ||
        currencyChanged;

      if (priceChanged) {
        await assertRole("admin", "dispatcher");
      }

      const newSaleCurrencyId =
        data.saleCurrencyId !== undefined ? data.saleCurrencyId ?? null : prev?.saleCurrencyId ?? null;
      if (currencyChanged && newSaleCurrencyId != null) {
        await getRateToBase(tx, newSaleCurrencyId);
      }

      const unitChanged = data.unit !== undefined && data.unit !== prev?.unit;
      if (unitChanged) {
        const collision = await tx.productPresentation.findUnique({
          where: { productId_name: { productId: id, name: data.unit as string } },
        });
        if (collision) {
          throw new Error(`UNIT_COLLISION:${data.unit}`);
        }
      }

      await tx.product.update({
        where: { productId: id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.sku !== undefined && { sku: data.sku || null }),
          ...(data.barcode !== undefined && { barcode: data.barcode || null }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.unit !== undefined && { unit: data.unit }),
          ...(data.minStock !== undefined && { minStock: data.minStock }),
          ...(data.maxStock !== undefined && { maxStock: data.maxStock ?? null }),
          ...(data.costPrice !== undefined && { costPrice: data.costPrice ?? null }),
          ...(data.salePrice !== undefined && { salePrice: data.salePrice ?? null }),
          ...(data.saleCurrencyId !== undefined && { saleCurrencyId: data.saleCurrencyId ?? null }),
          ...(data.valuationMethod !== undefined && { valuationMethod: data.valuationMethod }),
          ...(data.tracksLots !== undefined && { tracksLots: data.tracksLots }),
          ...(data.allowNegative !== undefined && { allowNegative: data.allowNegative }),
          ...(data.webstoreEnabled !== undefined && { webstoreEnabled: data.webstoreEnabled }),
          ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
          ...(data.supplierId !== undefined && { supplierId: data.supplierId ?? null }),
          ...(data.reorderPoint !== undefined && { reorderPoint: data.reorderPoint ?? null }),
          ...(data.reorderQuantity !== undefined && { reorderQuantity: data.reorderQuantity ?? null }),
          ...(data.isService !== undefined && { isService: data.isService }),
          ...(data.isCatchWeight !== undefined && { isCatchWeight: data.isCatchWeight }),
          ...(data.brand !== undefined && { brand: data.brand || null }),
          ...(data.supplier !== undefined && { supplier: data.supplier || null }),
          ...(data.supplierRef !== undefined && { supplierRef: data.supplierRef || null }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      if (priceChanged) {
        await tx.productPriceHistory.create({
          data: {
            productId: id,
            oldCostPrice: prev?.costPrice ?? null,
            newCostPrice: data.costPrice !== undefined ? data.costPrice : prev?.costPrice ?? null,
            oldSalePrice: prev?.salePrice ?? null,
            newSalePrice: data.salePrice !== undefined ? data.salePrice : prev?.salePrice ?? null,
            oldCurrencyId: prev?.saleCurrencyId ?? null,
            newCurrencyId: newSaleCurrencyId,
            changedBy: userId,
          },
        });
      }

      const salePriceChanged =
        data.salePrice !== undefined && Number(prev?.salePrice ?? NaN) !== data.salePrice;
      if (salePriceChanged || unitChanged || currencyChanged) {
        const base = await tx.productPresentation.findFirst({
          where: { productId: id, isBase: true },
        });
        if (base) {
          await tx.productPresentation.update({
            where: { presentationId: base.presentationId },
            data: {
              ...(salePriceChanged && { retailPrice: data.salePrice }),
              ...(currencyChanged && { priceCurrencyId: newSaleCurrencyId }),
              ...(unitChanged && { name: data.unit }),
            },
          });

          if (salePriceChanged || currencyChanged) {
            await tx.presentationPriceHistory.create({
              data: {
                presentationId: base.presentationId,
                oldRetailPrice: base.retailPrice,
                newRetailPrice: salePriceChanged ? data.salePrice : base.retailPrice,
                oldWholesalePrice: base.wholesalePrice ?? null,
                newWholesalePrice: base.wholesalePrice ?? null,
                oldCurrencyId: base.priceCurrencyId,
                newCurrencyId: newSaleCurrencyId,
                changedBy: userId,
              },
            });
          }
        }
      }

      await createAuditLog(tx, {
        action: "update",
        entityType: "Product",
        entityId: id,
        module: "inventory",
        userId,
        oldValues: prev,
        newValues: data,
      });

      const effectiveSalePrice =
        data.salePrice !== undefined
          ? data.salePrice
          : prev?.salePrice != null
            ? Number(prev.salePrice)
            : null;

      return {
        previousImageUrl: prev?.imageUrl ?? null,
        marginInput:
          priceChanged && effectiveSalePrice != null
            ? {
                productId: id,
                priceAmount: effectiveSalePrice,
                priceCurrencyId: newSaleCurrencyId,
              }
            : null,
      };
    });

    const newImageUrl = data.imageUrl !== undefined ? data.imageUrl || null : undefined;
    if (newImageUrl !== undefined && previousImageUrl && previousImageUrl !== newImageUrl) {
      await deleteProductImageBlob(previousImageUrl);
    }

    const margin = marginInput
      ? await safePriceMarginData(db, marginInput)
      : { marginWarning: null, replacementMarginPct: null, marginPct: null };

    revalidatePath("/products");
    return { success: true, data: margin };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    if (error instanceof GlobalRateNotConfiguredError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error && error.message.startsWith("UNIT_COLLISION:")) {
      const unit = error.message.split(":")[1];
      return { success: false, error: `Ya existe una presentación llamada '${unit}' para este producto` };
    }
    if (error instanceof Error && error.message === "CATCH_WEIGHT_REQUIRES_KG") {
      return { success: false, error: "Los productos de peso variable deben usar la unidad kg" };
    }
    if (error instanceof Error && error.message === "CATCH_WEIGHT_FORBIDS_NEGATIVE") {
      return {
        success: false,
        error: "Los productos de peso variable no permiten stock negativo",
      };
    }
    if (error instanceof Error && error.message === "CATCH_WEIGHT_HAS_PIECE_MOVEMENTS") {
      return {
        success: false,
        error:
          "No se puede desactivar peso variable: ya hay movimientos con piezas",
      };
    }
    console.error("Error updating product:", error);
    return { success: false, error: "Error al actualizar el producto" };
  }
}

export interface ProductCostInfo {
  /** Último costo de reposición en su moneda original (ProductCost.lastUnitCost). */
  replacementCost: number | null;
  replacementCostCurrencyCode: string | null;
  /** Costo de reposición convertido a base con la tasa VIGENTE. null si falta tasa. */
  replacementCostBase: number | null;
  /** Costo contable promedio (valuación), siempre en base. */
  accountingCostBase: number | null;
  /** Margen del precio vigente vs. costo contable. */
  marginPct: number | null;
  /** Margen del precio vigente vs. costo de reposición. */
  replacementMarginPct: number | null;
  baseCode: string;
}

/** Bloque de costos/margen del producto para la UI (solo lectura). */
export async function getProductCostInfoAction(
  productId: number
): Promise<ActionResult<ProductCostInfo>> {
  try {
    const [product, cost, base] = await Promise.all([
      db.product.findUnique({
        where: { productId },
        select: { salePrice: true, saleCurrencyId: true },
      }),
      db.productCost.findUnique({
        where: { productId },
        include: { currency: { select: { code: true } } },
      }),
      getBaseCurrency(db),
    ]);
    if (!product) return { success: false, error: "El producto no existe" };

    const info = await computeMarginInfo(db, {
      productId,
      priceAmount: product.salePrice != null ? Number(product.salePrice) : 0,
      priceCurrencyId: product.saleCurrencyId,
    });

    return {
      success: true,
      data: {
        replacementCost: cost?.lastUnitCost != null ? Number(cost.lastUnitCost) : null,
        replacementCostCurrencyCode: cost?.currency.code ?? null,
        replacementCostBase: info.replacementCostBase,
        accountingCostBase: info.accountingCostBase,
        marginPct: product.salePrice != null ? info.marginPct : null,
        replacementMarginPct: product.salePrice != null ? info.replacementMarginPct : null,
        baseCode: base.code,
      },
    };
  } catch (error) {
    console.error("Error fetching product cost info:", error);
    return { success: false, error: "Error al obtener los costos del producto" };
  }
}

export interface ProductPriceHistoryEntry {
  historyId: number;
  oldCostPrice: number | null;
  newCostPrice: number | null;
  oldSalePrice: number | null;
  newSalePrice: number | null;
  changedAt: string;
  changedByName: string | null;
}

export async function getProductPriceHistoryAction(
  productId: number
): Promise<ActionResult<ProductPriceHistoryEntry[]>> {
  try {
    const rows = await db.productPriceHistory.findMany({
      where: { productId },
      include: { changedByUser: { select: { fullName: true } } },
      orderBy: { changedAt: "desc" },
    });
    return {
      success: true,
      data: rows.map((r) => ({
        historyId: r.historyId,
        oldCostPrice: r.oldCostPrice != null ? Number(r.oldCostPrice) : null,
        newCostPrice: r.newCostPrice != null ? Number(r.newCostPrice) : null,
        oldSalePrice: r.oldSalePrice != null ? Number(r.oldSalePrice) : null,
        newSalePrice: r.newSalePrice != null ? Number(r.newSalePrice) : null,
        changedAt: r.changedAt.toISOString(),
        changedByName: r.changedByUser?.fullName ?? null,
      })),
    };
  } catch (error) {
    console.error("Error fetching product price history:", error);
    return { success: false, error: "Error al obtener el historial de precios" };
  }
}

export async function deleteProduct(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin");
    await db.$transaction(async (tx) => {
      const prev = await tx.product.findUnique({ where: { productId: id } });
      await tx.product.delete({ where: { productId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "Product",
        entityId: id,
        module: "inventory",
        userId,
        oldValues: prev,
      });
    });
    revalidatePath("/products");
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    console.error("Error deleting product:", error);
    return { success: false, error: "Error al eliminar el producto. Verifique que no tiene movimientos de stock." };
  }
}
