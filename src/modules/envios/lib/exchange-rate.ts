// Resolución de tasa por rangos. Usado en transfers y previews UI.
import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";

export class RateNotConfiguredError extends Error {
  constructor(message = "Sin tasa configurada para este monto") {
    super(message);
    this.name = "RateNotConfiguredError";
  }
}

type Tx = Prisma.TransactionClient | typeof db;

export type ResolvedRate = {
  rate: number;
  rangeId: number;
  minAmount: number;
  maxAmount: number | null;
};

/**
 * Devuelve la tasa aplicable al `amountInBase` dentro de la regla.
 * El monto cae en `[minAmount, maxAmount)` (max abierto). El último rango
 * puede tener `maxAmount = null` (∞).
 */
export async function resolveRate(
  client: Tx,
  ruleId: number,
  amountInBase: number
): Promise<ResolvedRate> {
  const ranges = await client.exchangeRateRange.findMany({
    where: { exchangeRateRuleId: ruleId },
    orderBy: { minAmount: "asc" },
  });
  if (!ranges.length) throw new RateNotConfiguredError("La regla no tiene rangos");

  for (const r of ranges) {
    const min = Number(r.minAmount);
    const max = r.maxAmount === null ? null : Number(r.maxAmount);
    if (amountInBase >= min && (max === null || amountInBase < max)) {
      return {
        rate: Number(r.rate),
        rangeId: r.rangeId,
        minAmount: min,
        maxAmount: max,
      };
    }
  }
  throw new RateNotConfiguredError(
    `Sin rango configurado para monto ${amountInBase}`
  );
}

/**
 * Convierte un monto en `base` a `quote` aplicando el rango correspondiente.
 * Si la regla tiene direccción invertida (rule.base es la moneda destino),
 * se asume que el `amount` viene en la moneda quote del rule y la conversión
 * inversa requiere que el caller lo maneje. Por defecto convierte multiplicando.
 */
export function convert(amount: number, rate: number): number {
  return amount * rate;
}
