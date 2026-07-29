import { db } from "@/lib/db";
import { getBaseCurrency, getRateToBase } from "@/lib/currency";

export interface PaymentCurrencyOption {
  currencyId: number;
  code: string;
  symbol: string;
  decimalPlaces: number;
  /** CUP por 1 unidad de esta moneda. null = sin tasa configurada. */
  rateToBase: number | null;
}

/**
 * Monedas activas con su tasa a la moneda base, para poblar el selector de
 * pagos multi-moneda (POS, cuentas por cobrar). Monedas sin tasa configurada
 * se incluyen igual (rateToBase null) para que el cajero vea el aviso en la
 * UI en vez de que la moneda simplemente desaparezca del selector.
 */
export async function getPaymentCurrencyOptions(): Promise<{
  currencies: PaymentCurrencyOption[];
  baseCurrencyId: number;
  baseCurrencyCode: string;
}> {
  const base = await getBaseCurrency(db);
  const currencies = await db.currency.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
    select: { currencyId: true, code: true, symbol: true, decimalPlaces: true },
  });

  const options = await Promise.all(
    currencies.map(async (c) => {
      if (c.currencyId === base.currencyId) {
        return { currencyId: c.currencyId, code: c.code, symbol: c.symbol, decimalPlaces: c.decimalPlaces, rateToBase: 1 };
      }
      try {
        const snapshot = await getRateToBase(db, c.currencyId);
        return { currencyId: c.currencyId, code: c.code, symbol: c.symbol, decimalPlaces: c.decimalPlaces, rateToBase: snapshot.rate };
      } catch {
        return { currencyId: c.currencyId, code: c.code, symbol: c.symbol, decimalPlaces: c.decimalPlaces, rateToBase: null };
      }
    })
  );

  return { currencies: options, baseCurrencyId: base.currencyId, baseCurrencyCode: base.code };
}
