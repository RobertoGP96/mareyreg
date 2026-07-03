import type { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { getBaseCurrency, getRateToBase } from "@/lib/currency";

type PrismaTx = Prisma.TransactionClient;
type DbOrTx = PrismaTx | typeof db;

/** Margen sobre costo de reposición por debajo del cual se advierte al usuario. */
export const LOW_MARGIN_THRESHOLD_PCT = 10;

export type MarginWarning = "negative" | "low" | null;

export interface ComputeMarginInfoInput {
  productId: number;
  /** Si el precio pertenece a una presentación, se usa su factor para llevarlo a unidad base. */
  presentationId?: number | null;
  /** Precio en la moneda `priceCurrencyId` (o base, si es null). */
  priceAmount: number;
  /** null = moneda base (CUP). */
  priceCurrencyId?: number | null;
}

export interface MarginInfo {
  /** Precio por unidad BASE, en moneda base (CUP). */
  priceBase: number;
  /** ProductCost.lastUnitCost convertido a base con la tasa VIGENTE (no la histórica). */
  replacementCostBase: number | null;
  /** Costo contable promedio (ProductValuation.totalCost / totalQty), en base. */
  accountingCostBase: number | null;
  /** Margen vs. costo contable. */
  marginPct: number | null;
  /** Margen vs. costo de reposición — el que dispara `warning`. */
  replacementMarginPct: number | null;
  warning: MarginWarning;
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
 * Costo contable promedio del producto (suma de todos los almacenes), en
 * unidad base y moneda base (la valuación ya vive siempre en CUP).
 */
async function getAccountingCostBase(client: DbOrTx, productId: number): Promise<number | null> {
  const valuations = await client.productValuation.findMany({
    where: { productId },
    select: { totalCost: true, totalQty: true },
  });
  if (valuations.length === 0) return null;

  const totalCost = valuations.reduce((sum, v) => sum + Number(v.totalCost), 0);
  const totalQty = valuations.reduce((sum, v) => sum + Number(v.totalQty), 0);
  if (totalQty <= 0) return null;

  return totalCost / totalQty;
}

/**
 * Info de margen para un precio dado (venta unitaria o de presentación) vs.
 * el costo de reposición (ProductCost, a tasa vigente) y el costo contable
 * (ProductValuation, ya en base). No lanza por falta de tasa: si la moneda
 * del PRECIO no tiene tasa configurada, propaga GlobalRateNotConfiguredError
 * (el caller decide cómo mostrarlo); si falta la tasa del COSTO de
 * reposición (moneda distinta, ej. costo en USD sin tasa), se trata como
 * costo no disponible en vez de romper el guardado del precio.
 */
export async function computeMarginInfo(
  client: DbOrTx,
  input: ComputeMarginInfoInput
): Promise<MarginInfo> {
  const base = await getBaseCurrency(client);

  let priceBase = input.priceAmount;
  if (input.priceCurrencyId != null && input.priceCurrencyId !== base.currencyId) {
    const { rate } = await getRateToBase(client, input.priceCurrencyId);
    priceBase = input.priceAmount * rate;
  }

  if (input.presentationId != null) {
    const presentation = await client.productPresentation.findUnique({
      where: { presentationId: input.presentationId },
      select: { factor: true },
    });
    const factor = presentation ? Number(presentation.factor) : 1;
    if (factor > 0) priceBase = priceBase / factor;
  }

  const cost = await client.productCost.findUnique({
    where: { productId: input.productId },
    select: { currencyId: true, lastUnitCost: true },
  });

  let replacementCostBase: number | null = null;
  if (cost?.lastUnitCost != null) {
    const unitCost = Number(cost.lastUnitCost);
    try {
      if (cost.currencyId === base.currencyId) {
        replacementCostBase = unitCost;
      } else {
        const { rate } = await getRateToBase(client, cost.currencyId);
        replacementCostBase = unitCost * rate;
      }
    } catch {
      // Sin tasa vigente para la moneda del costo: no bloquear el guardado
      // del precio, simplemente no hay margen de reposición para mostrar.
      replacementCostBase = null;
    }
  }

  const accountingCostBase = await getAccountingCostBase(client, input.productId);

  const marginPct = accountingCostBase != null ? marginPercent(priceBase, accountingCostBase) : null;
  const replacementMarginPct =
    replacementCostBase != null ? marginPercent(priceBase, replacementCostBase) : null;

  return {
    priceBase,
    replacementCostBase,
    accountingCostBase,
    marginPct,
    replacementMarginPct,
    warning: computeWarning(replacementMarginPct),
  };
}

/** Subconjunto de MarginInfo que las actions devuelven a la UI tras guardar un precio. */
export interface PriceMarginData {
  marginWarning: MarginWarning;
  /** Margen vs. costo de reposición (ProductCost a tasa vigente) — el que dispara warning. */
  replacementMarginPct: number | null;
  /** Margen vs. costo contable (valuación promedio). */
  marginPct: number | null;
}

/**
 * Margen tras guardar un precio: advertir, nunca impedir. Cualquier fallo
 * (sin tasa, sin costo de referencia) degrada a "sin datos de margen" en vez
 * de convertir un guardado exitoso en error.
 */
export async function safePriceMarginData(
  client: DbOrTx,
  input: ComputeMarginInfoInput
): Promise<PriceMarginData> {
  try {
    const info = await computeMarginInfo(client, input);
    return {
      marginWarning: info.warning,
      replacementMarginPct: info.replacementMarginPct,
      marginPct: info.marginPct,
    };
  } catch (error) {
    console.error("No se pudo calcular el margen tras guardar el precio:", error);
    return { marginWarning: null, replacementMarginPct: null, marginPct: null };
  }
}
