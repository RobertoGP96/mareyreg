import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;
export type DbOrTx = PrismaTx | typeof db;

export type BaseCurrencyInfo = {
  currencyId: number;
  code: string;
  symbol: string;
  decimalPlaces: number;
};

// rate = unidades de moneda BASE por 1 unidad de la moneda origen.
// exchangeRateId es null cuando origen === base (conversión identidad, sin fila en DB).
export type RateSnapshot = {
  exchangeRateId: number | null;
  rate: number;
};

export class GlobalRateNotConfiguredError extends Error {
  constructor(fromCode: string, baseCode: string) {
    super(
      `No hay una tasa de cambio configurada entre ${fromCode} y ${baseCode}. Configúrala en Divisas antes de continuar.`
    );
    this.name = "GlobalRateNotConfiguredError";
  }
}

export async function getBaseCurrency(client: DbOrTx): Promise<BaseCurrencyInfo> {
  const company = await client.company.findUnique({
    where: { id: 1 },
    include: { baseCurrency: true },
  });

  if (!company?.baseCurrency) {
    throw new Error("La empresa no tiene moneda base configurada. Ejecuta el backfill de monedas.");
  }

  return {
    currencyId: company.baseCurrency.currencyId,
    code: company.baseCurrency.code,
    symbol: company.baseCurrency.symbol,
    decimalPlaces: company.baseCurrency.decimalPlaces,
  };
}

export async function getRateToBase(
  client: DbOrTx,
  fromCurrencyId: number
): Promise<RateSnapshot> {
  const base = await getBaseCurrency(client);

  if (fromCurrencyId === base.currencyId) {
    return { exchangeRateId: null, rate: 1 };
  }

  const direct = await client.exchangeRate.findUnique({
    where: {
      baseCurrencyId_quoteCurrencyId: {
        baseCurrencyId: fromCurrencyId,
        quoteCurrencyId: base.currencyId,
      },
    },
  });
  if (direct) {
    return { exchangeRateId: direct.exchangeRateId, rate: direct.rate.toNumber() };
  }

  const inverse = await client.exchangeRate.findUnique({
    where: {
      baseCurrencyId_quoteCurrencyId: {
        baseCurrencyId: base.currencyId,
        quoteCurrencyId: fromCurrencyId,
      },
    },
  });
  if (inverse) {
    return {
      exchangeRateId: inverse.exchangeRateId,
      rate: new Prisma.Decimal(1).dividedBy(inverse.rate).toNumber(),
    };
  }

  const fromCurrency = await client.currency.findUnique({ where: { currencyId: fromCurrencyId } });
  throw new GlobalRateNotConfiguredError(fromCurrency?.code ?? `#${fromCurrencyId}`, base.code);
}

export async function convertToBase(
  client: DbOrTx,
  amount: number,
  fromCurrencyId: number
): Promise<{ amountBase: number; rate: number; exchangeRateId: number | null }> {
  const snapshot = await getRateToBase(client, fromCurrencyId);
  return {
    amountBase: amount * snapshot.rate,
    rate: snapshot.rate,
    exchangeRateId: snapshot.exchangeRateId,
  };
}

// Redondeo half-up estable: evita que artefactos de coma flotante binaria
// (ej. 1.005 -> 1.00 en vez de 1.01) rompan el redondeo de montos monetarios.
export function roundToCurrency(amount: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}
