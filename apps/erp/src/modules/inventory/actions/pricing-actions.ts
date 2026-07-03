"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { ActionResult } from "@/types";
import { getEffectivePrice } from "../lib/effective-price";
import { LOW_MARGIN_THRESHOLD_PCT, type MarginWarning } from "../lib/margin";
import { getBaseCurrency, getRateToBase, GlobalRateNotConfiguredError } from "@/lib/currency";
import {
  bulkPriceAdjustmentSchema,
  buildPriceExpression,
  buildScopeCondition,
  buildCurrencyCondition,
  type BulkPriceAdjustmentInput,
} from "../lib/bulk-price";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof GlobalRateNotConfiguredError) return error.message;
  return fallback;
}

/**
 * Precio sugerido para una línea de venta (POS/B2B). Migrado a `ProductCost`
 * (costo de reposición) como fuente del "costo" mostrado al usuario, con
 * fallback al espejo `Product.costPrice` si el producto aún no tiene
 * recepciones registradas (ProductCost solo se crea al recibir mercancía).
 */
export async function getSuggestedUnitPriceAction(
  productId: number,
  quantity: number,
  customerId?: number,
  presentationId?: number
): Promise<ActionResult<{ basePrice: number; finalPrice: number; suggestedCostBase: number | null }>> {
  try {
    const [price, cost, product, base] = await Promise.all([
      getEffectivePrice(db, { productId, quantity, customerId, presentationId }),
      db.productCost.findUnique({ where: { productId }, select: { currencyId: true, lastUnitCost: true } }),
      db.product.findUnique({ where: { productId }, select: { costPrice: true } }),
      getBaseCurrency(db),
    ]);

    let suggestedCostBase: number | null = null;
    if (cost?.lastUnitCost != null) {
      const unitCost = Number(cost.lastUnitCost);
      if (cost.currencyId === base.currencyId) {
        suggestedCostBase = unitCost;
      } else {
        try {
          const { rate } = await getRateToBase(db, cost.currencyId);
          suggestedCostBase = unitCost * rate;
        } catch {
          suggestedCostBase = null;
        }
      }
    } else if (product?.costPrice != null) {
      suggestedCostBase = Number(product.costPrice);
    }

    return {
      success: true,
      data: { basePrice: price.basePrice, finalPrice: price.finalPrice, suggestedCostBase },
    };
  } catch (error) {
    console.error("Error getting suggested unit price:", error);
    return { success: false, error: toUserMessage(error, "Error al calcular el precio") };
  }
}

export interface BulkPriceAdjustmentPreviewRow {
  presentationId: number;
  productName: string;
  presentationName: string;
  isBase: boolean;
  oldRetail: number;
  newRetail: number;
  oldWholesale: number | null;
  newWholesale: number | null;
  /** Margen del nuevo precio de menudeo vs. costo de reposición (null si no hay costo de referencia). */
  marginWarning: MarginWarning;
  replacementMarginPct: number | null;
}

interface RawPreviewRow {
  presentation_id: number;
  product_id: number;
  product_name: string;
  presentation_name: string;
  is_base: boolean;
  factor: unknown;
  price_currency_id: number | null;
  old_retail: unknown;
  new_retail: unknown;
  old_wholesale: unknown;
  new_wholesale: unknown;
  total_count: unknown;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

/**
 * Margen de reposición por fila de preview, en batch: una sola resolución de
 * tasa por moneda distinta involucrada (evita el N+1 de computeMarginInfo,
 * que resuelve tasa por llamada). El costo de reposición se obtiene con un
 * solo IN sobre los productIds de las filas visibles.
 */
async function computeRowMargins(
  rows: RawPreviewRow[]
): Promise<Map<number, { warning: MarginWarning; replacementMarginPct: number | null }>> {
  const result = new Map<number, { warning: MarginWarning; replacementMarginPct: number | null }>();
  if (rows.length === 0) return result;

  const base = await getBaseCurrency(db);
  const productIds = Array.from(new Set(rows.map((r) => r.product_id)));
  const costs = await db.productCost.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true, currencyId: true, lastUnitCost: true },
  });
  const costByProductId = new Map(costs.map((c) => [c.productId, c]));

  const rateCache = new Map<number, number | null>();
  async function rateFor(currencyId: number): Promise<number | null> {
    if (currencyId === base.currencyId) return null;
    if (rateCache.has(currencyId)) return rateCache.get(currencyId) ?? null;
    try {
      const { rate } = await getRateToBase(db, currencyId);
      rateCache.set(currencyId, rate);
      return rate;
    } catch {
      rateCache.set(currencyId, null);
      return null;
    }
  }

  for (const row of rows) {
    const cost = costByProductId.get(row.product_id);
    if (!cost?.lastUnitCost) continue;

    const costRate = await rateFor(cost.currencyId);
    const replacementCostBase = costRate != null ? Number(cost.lastUnitCost) * costRate : Number(cost.lastUnitCost);

    const priceRate = row.price_currency_id != null ? await rateFor(row.price_currency_id) : null;
    const newRetailBase = priceRate != null ? Number(row.new_retail) * priceRate : Number(row.new_retail);
    const factor = Number(row.factor) || 1;
    const priceBase = newRetailBase / factor;

    if (replacementCostBase <= 0) continue;
    const replacementMarginPct = ((priceBase - replacementCostBase) / replacementCostBase) * 100;
    const warning: MarginWarning =
      replacementMarginPct < 0
        ? "negative"
        : replacementMarginPct < LOW_MARGIN_THRESHOLD_PCT
          ? "low"
          : null;

    result.set(row.presentation_id, { warning, replacementMarginPct });
  }

  return result;
}

/**
 * Vista previa del ajuste masivo: no escribe nada, solo simula la expresión
 * de precio sobre hasta 200 filas que matchean el scope, más el total real
 * de filas afectadas (vía COUNT(*) OVER(), una sola query).
 */
export async function previewBulkPriceAdjustment(
  input: unknown
): Promise<ActionResult<{ rows: BulkPriceAdjustmentPreviewRow[]; totalCount: number }>> {
  try {
    await assertRole("admin");

    const parsed = bulkPriceAdjustmentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Datos de ajuste de precio inválidos" };
    }
    const data = parsed.data;

    const scope = buildScopeCondition(data.scope);
    const currency =
      data.priceCurrencyId !== undefined
        ? buildCurrencyCondition(data.priceCurrencyId, scope.params.length)
        : null;
    const includesRetail = data.target === "retail" || data.target === "both";
    const includesWholesale = data.target === "wholesale" || data.target === "both";

    const newRetailExpr = includesRetail
      ? buildPriceExpression("pp.retail_price", data)
      : "pp.retail_price";
    const newWholesaleExpr = includesWholesale
      ? buildPriceExpression("pp.wholesale_price", data)
      : "pp.wholesale_price";

    const whereClause = currency ? `${scope.sql} AND ${currency.sql}` : scope.sql;
    const allParams = currency ? [...scope.params, ...currency.params] : scope.params;

    const sql = `
      SELECT
        pp.presentation_id,
        pp.product_id,
        p.name AS product_name,
        pp.name AS presentation_name,
        pp.is_base,
        pp.factor,
        pp.price_currency_id,
        pp.retail_price AS old_retail,
        ${newRetailExpr} AS new_retail,
        pp.wholesale_price AS old_wholesale,
        CASE WHEN pp.wholesale_price IS NOT NULL THEN ${newWholesaleExpr} ELSE NULL END AS new_wholesale,
        COUNT(*) OVER() AS total_count
      FROM product_presentations pp
      JOIN products p ON p.product_id = pp.product_id
      WHERE pp.is_active AND p.is_active AND ${whereClause}
      ORDER BY pp.presentation_id
      LIMIT 200
    `;

    const rawRows = (await db.$queryRawUnsafe(sql, ...allParams)) as RawPreviewRow[];
    const margins = await computeRowMargins(rawRows);

    const rows: BulkPriceAdjustmentPreviewRow[] = rawRows.map((r) => ({
      presentationId: r.presentation_id,
      productName: r.product_name,
      presentationName: r.presentation_name,
      isBase: r.is_base,
      oldRetail: Number(r.old_retail),
      newRetail: Number(r.new_retail),
      marginWarning: margins.get(r.presentation_id)?.warning ?? null,
      replacementMarginPct: margins.get(r.presentation_id)?.replacementMarginPct ?? null,
      oldWholesale: toNullableNumber(r.old_wholesale),
      newWholesale: toNullableNumber(r.new_wholesale),
    }));

    const totalCount = rawRows.length > 0 ? Number(rawRows[0].total_count) : 0;

    return { success: true, data: { rows, totalCount } };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: "No tienes permisos para ajustar precios" };
    }
    console.error("previewBulkPriceAdjustment:", error);
    return { success: false, error: toUserMessage(error, "No se pudo generar la vista previa") };
  }
}

/**
 * Aplica el ajuste masivo de precios de forma set-based dentro de una
 * transacción corta. Orden de sentencias (importante, no reordenar):
 *
 * 1. INSERT a presentation_price_history ANTES del UPDATE de presentaciones,
 *    para capturar old=valor vigente y new=expresión calculada (el UPDATE
 *    aún no corrió, así que pp.retail_price/wholesale_price siguen siendo
 *    los valores viejos en este punto).
 * 2. UPDATE de product_presentations con la misma expresión.
 * 3. Si target incluye "retail": INSERT a product_price_history capturando
 *    old=p.sale_price (aún viejo) y new=pp.retail_price — pero leído DESPUÉS
 *    del paso 2, por lo que pp.retail_price ya es el nuevo valor. Luego
 *    UPDATE de products.sale_price espejando pp.retail_price de la
 *    presentación base.
 * 4. Audit log dentro de la misma transacción.
 * 5. revalidatePath fuera de la transacción.
 *
 * Ninguna de estas sentencias interpola strings de usuario: `category` y
 * `reason` viajan siempre como parámetros bind ($n). Los únicos fragmentos
 * interpolados directamente son la expresión de precio (construida solo a
 * partir de nombres de columna fijos y enums ya validados por Zod, ver
 * `buildPriceExpression`) y el WHERE de scope (construido por
 * `buildScopeCondition`, que también parametriza cualquier valor de usuario).
 */
/**
 * Combina el scope con el filtro opcional de moneda del precio, generando
 * placeholders `$N` consecutivos. Se recalcula por sentencia (en vez de
 * reusar params) porque cada `$executeRawUnsafe` es una query independiente
 * y necesita su propia numeración empezando en $1.
 */
function combinedWhere(data: BulkPriceAdjustmentInput): { sql: string; params: unknown[] } {
  const scope = buildScopeCondition(data.scope);
  if (data.priceCurrencyId === undefined) return scope;
  const currency = buildCurrencyCondition(data.priceCurrencyId, scope.params.length);
  return { sql: `${scope.sql} AND ${currency.sql}`, params: [...scope.params, ...currency.params] };
}

export async function applyBulkPriceAdjustment(
  input: unknown
): Promise<ActionResult<{ affectedCount: number }>> {
  try {
    await assertRole("admin");
    const userId = await requireCurrentUserId();

    const parsed = bulkPriceAdjustmentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Datos de ajuste de precio inválidos" };
    }
    const data: BulkPriceAdjustmentInput = parsed.data;

    const includesRetail = data.target === "retail" || data.target === "both";
    const includesWholesale = data.target === "wholesale" || data.target === "both";
    const reason = data.reason ?? null;

    const newRetailExpr = includesRetail
      ? buildPriceExpression("pp.retail_price", data)
      : "pp.retail_price";
    const newWholesaleExpr = includesWholesale
      ? buildPriceExpression("pp.wholesale_price", data)
      : "pp.wholesale_price";

    const affectedCount = await db.$transaction(async (tx) => {
      // 1. Historial de presentaciones — captura old/new ANTES del UPDATE.
      // El scope+moneda genera $1..$k; userId y reason van en $k+1 y $k+2.
      const presScope = combinedWhere(data);
      const presUserIdParam = presScope.params.length + 1;
      const presReasonParam = presScope.params.length + 2;

      const wholesaleNewForHistory = includesWholesale
        ? `CASE WHEN pp.wholesale_price IS NOT NULL THEN ${newWholesaleExpr} ELSE NULL END`
        : "pp.wholesale_price";

      const insertPresHistorySql = `
        INSERT INTO presentation_price_history (
          presentation_id, old_retail_price, new_retail_price,
          old_wholesale_price, new_wholesale_price, old_currency_id, new_currency_id,
          changed_by, reason
        )
        SELECT
          pp.presentation_id,
          pp.retail_price,
          ${newRetailExpr},
          pp.wholesale_price,
          ${wholesaleNewForHistory},
          pp.price_currency_id,
          pp.price_currency_id,
          $${presUserIdParam},
          $${presReasonParam}
        FROM product_presentations pp
        JOIN products p ON p.product_id = pp.product_id
        WHERE pp.is_active AND p.is_active AND ${presScope.sql}
      `;
      await tx.$executeRawUnsafe(
        insertPresHistorySql,
        ...presScope.params,
        userId,
        reason
      );

      // 2. UPDATE set-based de las presentaciones en scope.
      const updateScope = combinedWhere(data);
      const setClauses = [`retail_price = ${newRetailExpr}`];
      if (includesWholesale) {
        setClauses.push(
          `wholesale_price = CASE WHEN pp.wholesale_price IS NOT NULL THEN ${newWholesaleExpr} ELSE NULL END`
        );
      }

      const updatePresSql = `
        UPDATE product_presentations pp
        SET ${setClauses.join(", ")}
        FROM products p
        WHERE p.product_id = pp.product_id
          AND pp.is_active AND p.is_active AND ${updateScope.sql}
      `;
      const affected = await tx.$executeRawUnsafe(updatePresSql, ...updateScope.params);

      // 3. Espejo de producto base — solo si el target incluye "retail",
      // y SOLO después de (2), para tomar el retail_price ya actualizado.
      if (includesRetail) {
        const baseScope = combinedWhere(data);
        const baseUserIdParam = baseScope.params.length + 1;
        const baseReasonParam = baseScope.params.length + 2;

        const insertProdHistorySql = `
          INSERT INTO product_price_history (
            product_id, old_sale_price, new_sale_price, old_currency_id, new_currency_id, changed_by, reason
          )
          SELECT p.product_id, p.sale_price, pp.retail_price, p.sale_currency_id, pp.price_currency_id,
            $${baseUserIdParam}, $${baseReasonParam}
          FROM products p
          JOIN product_presentations pp ON pp.product_id = p.product_id
          WHERE pp.is_base AND pp.is_active AND p.is_active AND ${baseScope.sql}
        `;
        await tx.$executeRawUnsafe(
          insertProdHistorySql,
          ...baseScope.params,
          userId,
          reason
        );

        const updateProdScope = combinedWhere(data);
        const updateProdSql = `
          UPDATE products p
          SET sale_price = pp.retail_price
          FROM product_presentations pp
          WHERE pp.product_id = p.product_id
            AND pp.is_base AND pp.is_active AND p.is_active AND ${updateProdScope.sql}
        `;
        await tx.$executeRawUnsafe(updateProdSql, ...updateProdScope.params);
      }

      // 4. Audit log dentro de la misma transacción.
      await createAuditLog(tx, {
        module: "inventory",
        action: "bulk_price_adjustment",
        entityType: "ProductPresentation",
        entityId: 0,
        newValues: { ...data, affectedCount: affected },
        userId,
      });

      return affected;
    });

    revalidatePath("/products");
    revalidatePath("/pos");

    return { success: true, data: { affectedCount } };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: "No tienes permisos para ajustar precios" };
    }
    console.error("applyBulkPriceAdjustment:", error);
    return { success: false, error: toUserMessage(error, "No se pudo aplicar el ajuste de precios") };
  }
}
