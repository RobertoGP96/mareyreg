// Lecturas del catálogo de monedas y denominaciones (modelos de envios) con
// la forma mínima que necesitan los formularios de entregas. Es la única
// dependencia de datos entre entregas y envios.
import { db } from "@/lib/db";
import type { CurrencyOption } from "../lib/types";

export async function getCurrencyOptions(): Promise<CurrencyOption[]> {
  return db.currency.findMany({
    orderBy: [{ active: "desc" }, { code: "asc" }],
    select: {
      currencyId: true,
      code: true,
      name: true,
      symbol: true,
      kind: true,
      decimalPlaces: true,
      active: true,
    },
  });
}

export type ActiveDenomination = {
  denominationId: number;
  value: string;
  label: string | null;
};

/**
 * Catálogo activo agrupado por moneda. Alimenta el editor de desglose, que
 * necesita todas las monedas de golpe porque una entrega mezcla varias.
 */
export async function getActiveDenominationsByCurrency(): Promise<
  Record<number, ActiveDenomination[]>
> {
  const rows = await db.currencyDenomination.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { value: "desc" }],
    select: { denominationId: true, currencyId: true, value: true, label: true },
  });

  const byCurrency: Record<number, ActiveDenomination[]> = {};
  for (const r of rows) {
    (byCurrency[r.currencyId] ??= []).push({
      denominationId: r.denominationId,
      value: r.value.toString(),
      label: r.label,
    });
  }
  return byCurrency;
}
