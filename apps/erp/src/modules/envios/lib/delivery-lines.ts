// Punto único de verdad para validar y resolver las líneas de una entrega.
// Lo comparten create y update para que las dos rutas no se desincronicen.
import type { Prisma } from "@/generated/prisma";
import type { CashDeliveryLineInput } from "./schemas";

type Tx = Prisma.TransactionClient;

export type ResolvedDeliveryDenomination = {
  denominationId: number;
  quantity: number;
  unitValue: number;
};

export type ResolvedDeliveryLine = {
  currencyId: number;
  amount: number;
  denominations: ResolvedDeliveryDenomination[];
};

// Compara en enteros escalados por los decimales de LA MONEDA DE LA LÍNEA
// (CUP usa 0), no un 2 fijo. Evita que artefactos binarios como 0.1 + 0.2
// hagan fallar un desglose que en realidad cuadra.
export function scaledEquals(a: number, b: number, decimalPlaces: number): boolean {
  const factor = 10 ** decimalPlaces;
  return Math.round((a + Number.EPSILON) * factor) === Math.round((b + Number.EPSILON) * factor);
}

export function scaleToCurrency(amount: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

const DB_ERROR_MESSAGES: Record<string, string> = {
  err_delivery_breakdown_mismatch:
    "El desglose de billetes no cuadra con el monto de la entrega.",
  err_denomination_currency_mismatch:
    "Una denominación no corresponde a la moneda de su monto.",
  err_denomination_value_snapshot:
    "El valor de una denominación cambió mientras guardabas. Recarga e intenta de nuevo.",
  err_delivery_without_lines: "La entrega debe tener al menos un monto.",
};

// Traduce los errores de los triggers de envios-cash-delivery.sql a español.
// Sin esto el usuario vería el mensaje crudo de Postgres.
export function describeDeliveryDbError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  for (const [code, message] of Object.entries(DB_ERROR_MESSAGES)) {
    if (raw.includes(code)) return message;
  }
  return fallback;
}

/**
 * Valida las líneas contra el catálogo y calcula el monto de cada una.
 *
 * El monto y el `unitValue` NUNCA vienen del cliente: se leen de
 * `currency_denominations` dentro de la misma transacción, igual que el
 * `unitFactor` de las líneas de venta.
 */
export async function resolveDeliveryLines(
  tx: Tx,
  lines: CashDeliveryLineInput[]
): Promise<ResolvedDeliveryLine[]> {
  const currencyIds = [...new Set(lines.map((l) => l.currencyId))];
  const denominationIds = [
    ...new Set(lines.flatMap((l) => l.denominations.map((d) => d.denominationId))),
  ];

  const [currencies, denominations] = await Promise.all([
    tx.currency.findMany({
      where: { currencyId: { in: currencyIds } },
      select: {
        currencyId: true,
        code: true,
        kind: true,
        active: true,
        decimalPlaces: true,
      },
    }),
    tx.currencyDenomination.findMany({
      where: { denominationId: { in: denominationIds } },
      select: { denominationId: true, currencyId: true, value: true, active: true },
    }),
  ]);

  const currencyById = new Map(currencies.map((c) => [c.currencyId, c]));
  const denominationById = new Map(denominations.map((d) => [d.denominationId, d]));

  return lines.map((line) => {
    const currency = currencyById.get(line.currencyId);
    if (!currency) throw new Error("Moneda inválida en uno de los montos");
    if (!currency.active) throw new Error(`La moneda ${currency.code} está desactivada`);

    // Moneda digital: no hay billetes que desglosar, el monto se captura directo.
    if (currency.kind === "digital") {
      if (line.denominations.length > 0) {
        throw new Error(`${currency.code} es digital y no admite desglose de billetes`);
      }
      const amount = scaleToCurrency(line.amount ?? 0, currency.decimalPlaces);
      if (amount <= 0) throw new Error(`El monto en ${currency.code} debe ser mayor a 0`);
      return { currencyId: line.currencyId, amount, denominations: [] };
    }

    if (line.denominations.length === 0) {
      throw new Error(`Captura el desglose de billetes en ${currency.code}`);
    }

    const resolved: ResolvedDeliveryDenomination[] = line.denominations.map((entry) => {
      const denomination = denominationById.get(entry.denominationId);
      if (!denomination) {
        throw new Error(`Denominación inexistente en el monto en ${currency.code}`);
      }
      if (!denomination.active) {
        throw new Error(`Hay una denominación desactivada en el monto en ${currency.code}`);
      }
      if (denomination.currencyId !== line.currencyId) {
        throw new Error(`Una denominación no pertenece a ${currency.code}`);
      }
      return {
        denominationId: denomination.denominationId,
        quantity: entry.quantity,
        unitValue: denomination.value.toNumber(),
      };
    });

    const amount = scaleToCurrency(
      resolved.reduce((sum, d) => sum + d.unitValue * d.quantity, 0),
      currency.decimalPlaces
    );
    if (amount <= 0) {
      throw new Error(`El monto en ${currency.code} debe ser mayor a 0`);
    }

    return { currencyId: line.currencyId, amount, denominations: resolved };
  });
}
