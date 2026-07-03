import { db } from "@/lib/db";
import { getBaseCurrency, getRateToBase } from "@/lib/currency";

export interface CurrencyOption {
  currencyId: number;
  code: string;
  symbol: string;
  decimalPlaces: number;
}

export interface ProductCurrencyContext {
  baseCurrencyId: number;
  baseCode: string;
  baseDecimalPlaces: number;
  /** Monedas activas (incluye la base) para el select de moneda de precio. */
  options: CurrencyOption[];
  /** Tasa a base por moneda no-base; null si no hay tasa configurada. */
  ratesByCurrencyId: Record<number, number | null>;
}

/**
 * Contexto de monedas para las pantallas de precios de inventario: opciones
 * del select + tasas vigentes resueltas UNA vez en el server (el cliente
 * nunca convierte con tasas propias, solo muestra lo ya calculado).
 */
export async function getProductCurrencyContext(): Promise<ProductCurrencyContext> {
  const [base, currencies] = await Promise.all([
    getBaseCurrency(db),
    db.currency.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      select: { currencyId: true, code: true, symbol: true, decimalPlaces: true },
    }),
  ]);

  const ratesByCurrencyId: Record<number, number | null> = {};
  for (const currency of currencies) {
    if (currency.currencyId === base.currencyId) continue;
    try {
      const { rate } = await getRateToBase(db, currency.currencyId);
      ratesByCurrencyId[currency.currencyId] = rate;
    } catch {
      // Sin tasa configurada: la UI muestra el precio sin equivalente CUP.
      ratesByCurrencyId[currency.currencyId] = null;
    }
  }

  return {
    baseCurrencyId: base.currencyId,
    baseCode: base.code,
    baseDecimalPlaces: base.decimalPlaces,
    options: currencies,
    ratesByCurrencyId,
  };
}
