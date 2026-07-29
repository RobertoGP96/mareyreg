import { db } from "@/lib/db";
import { getBaseCurrency, getRateToBase } from "@/lib/currency";
import { getEffectiveLinePrices, lineKey } from "../lib/effective-price";
import { LOW_MARGIN_THRESHOLD_PCT, type MarginWarning } from "../lib/margin";

export interface MarginReportOptions {
  warehouseId?: number;
  /** Si es true, solo incluye filas con warning (negative/low). */
  onlyWarnings?: boolean;
  /** Máximo de filas a devolver, ordenadas por peor margen primero. Default 200. */
  limit?: number;
}

export interface MarginReportRow {
  productId: number;
  productName: string;
  sku: string | null;
  category: string | null;
  /** Precio de venta efectivo por unidad base, en moneda base (CUP). */
  priceBase: number;
  /** Costo contable promedio (ProductValuation), en base. null si no hay stock valuado. */
  accountingCostBase: number | null;
  /** Costo de reposición (ProductCost) a la tasa vigente, en base. null si no hay costo registrado. */
  replacementCostBase: number | null;
  /** Margen vs. costo contable. */
  marginPct: number | null;
  /** Margen vs. costo de reposición — dispara warning. */
  replacementMarginPct: number | null;
  warning: MarginWarning;
  /** Moneda de compra original del costo de reposición, si distinta de la base. */
  purchaseCurrencyCode: string | null;
}

export interface MarginReportSummary {
  totalProducts: number;
  negativeCount: number;
  lowCount: number;
  avgReplacementMarginPct: number | null;
}

export interface MarginReportResult {
  rows: MarginReportRow[];
  summary: MarginReportSummary;
}

function marginPercent(priceBase: number, costBase: number): number | null {
  if (costBase <= 0) return null;
  return ((priceBase - costBase) / costBase) * 100;
}

function computeWarning(replacementMarginPct: number | null): MarginWarning {
  if (replacementMarginPct == null) return null;
  if (replacementMarginPct < 0) return "negative";
  if (replacementMarginPct < LOW_MARGIN_THRESHOLD_PCT) return "low";
  return null;
}

/**
 * Reporte de márgenes por producto: precio efectivo (unidad base, CUP) vs.
 * costo contable (valuación promedio) y costo de reposición (ProductCost a
 * tasa vigente). Batch de tasas de cambio (una consulta por moneda distinta,
 * no por producto) para evitar N+1 en catálogos grandes. Ordena por peor
 * margen de reposición primero (negativos, luego bajos, luego el resto).
 */
export async function getMarginReport(
  options: MarginReportOptions = {}
): Promise<MarginReportResult> {
  const limit = options.limit ?? 200;
  const base = await getBaseCurrency(db);

  const products = await db.product.findMany({
    where: {
      isActive: true,
      isService: false,
      OR: [{ salePrice: { not: null } }, { salePrice: null }],
    },
    select: {
      productId: true,
      name: true,
      sku: true,
      category: true,
      salePrice: true,
    },
  });
  const productsWithPrice = products.filter((p) => p.salePrice != null);
  if (productsWithPrice.length === 0) {
    return { rows: [], summary: { totalProducts: 0, negativeCount: 0, lowCount: 0, avgReplacementMarginPct: null } };
  }
  const productIds = productsWithPrice.map((p) => p.productId);

  const [priceMap, valuations, costs] = await Promise.all([
    getEffectiveLinePrices(
      db,
      productIds.map((productId) => ({ productId, quantity: 1 })),
      {}
    ),
    db.productValuation.findMany({
      where: {
        productId: { in: productIds },
        ...(options.warehouseId != null ? { warehouseId: options.warehouseId } : {}),
      },
      select: { productId: true, totalCost: true, totalQty: true },
    }),
    db.productCost.findMany({
      where: { productId: { in: productIds } },
      select: {
        productId: true,
        currencyId: true,
        lastUnitCost: true,
        currency: { select: { code: true } },
      },
    }),
  ]);

  const accountingCostByProduct = new Map<number, { totalCost: number; totalQty: number }>();
  for (const v of valuations) {
    const cur = accountingCostByProduct.get(v.productId) ?? { totalCost: 0, totalQty: 0 };
    cur.totalCost += Number(v.totalCost);
    cur.totalQty += Number(v.totalQty);
    accountingCostByProduct.set(v.productId, cur);
  }

  // Batch de tasas: una consulta por moneda distinta entre TODOS los costos,
  // en vez de una por producto.
  const distinctCurrencyIds = Array.from(
    new Set(costs.map((c) => c.currencyId).filter((id) => id !== base.currencyId))
  );
  const rateByCurrencyId = new Map<number, number | null>();
  await Promise.all(
    distinctCurrencyIds.map(async (currencyId) => {
      try {
        const { rate } = await getRateToBase(db, currencyId);
        rateByCurrencyId.set(currencyId, rate);
      } catch {
        rateByCurrencyId.set(currencyId, null);
      }
    })
  );

  const costByProduct = new Map(costs.map((c) => [c.productId, c]));

  const rows: MarginReportRow[] = [];
  for (const product of productsWithPrice) {
    const priceResult = priceMap.get(lineKey(product.productId, null));
    const priceBase = priceResult?.finalPrice ?? 0;

    const valuation = accountingCostByProduct.get(product.productId);
    const accountingCostBase =
      valuation && valuation.totalQty > 0 ? valuation.totalCost / valuation.totalQty : null;

    const cost = costByProduct.get(product.productId);
    let replacementCostBase: number | null = null;
    let purchaseCurrencyCode: string | null = null;
    if (cost?.lastUnitCost != null) {
      const unitCost = Number(cost.lastUnitCost);
      if (cost.currencyId === base.currencyId) {
        replacementCostBase = unitCost;
      } else {
        const rate = rateByCurrencyId.get(cost.currencyId);
        if (rate != null) {
          replacementCostBase = unitCost * rate;
          purchaseCurrencyCode = cost.currency.code;
        }
      }
    }

    const marginPct = accountingCostBase != null ? marginPercent(priceBase, accountingCostBase) : null;
    const replacementMarginPct =
      replacementCostBase != null ? marginPercent(priceBase, replacementCostBase) : null;

    rows.push({
      productId: product.productId,
      productName: product.name,
      sku: product.sku,
      category: product.category,
      priceBase,
      accountingCostBase,
      replacementCostBase,
      marginPct,
      replacementMarginPct,
      warning: computeWarning(replacementMarginPct),
      purchaseCurrencyCode,
    });
  }

  const negativeCount = rows.filter((r) => r.warning === "negative").length;
  const lowCount = rows.filter((r) => r.warning === "low").length;
  const withReplacementMargin = rows.filter((r) => r.replacementMarginPct != null);
  const avgReplacementMarginPct =
    withReplacementMargin.length > 0
      ? withReplacementMargin.reduce((sum, r) => sum + (r.replacementMarginPct ?? 0), 0) /
        withReplacementMargin.length
      : null;

  const filtered = options.onlyWarnings ? rows.filter((r) => r.warning != null) : rows;

  // Peor margen primero: null al final (sin datos de reposición), luego
  // ascendente (más negativo primero).
  const sorted = [...filtered].sort((a, b) => {
    if (a.replacementMarginPct == null && b.replacementMarginPct == null) return 0;
    if (a.replacementMarginPct == null) return 1;
    if (b.replacementMarginPct == null) return -1;
    return a.replacementMarginPct - b.replacementMarginPct;
  });

  return {
    rows: sorted.slice(0, limit),
    summary: {
      totalProducts: rows.length,
      negativeCount,
      lowCount,
      avgReplacementMarginPct,
    },
  };
}
