import type { WebstoreCurrency, WebstoreProduct } from "@/lib/erp-client";

/** Fallback antes de que cargue el catálogo (ver store.tsx): CUP, 0 decimales, igual que getBaseCurrency en el ERP. */
export const DEFAULT_CURRENCY: WebstoreCurrency = {
  code: "CUP",
  symbol: "$",
  decimalPlaces: 0,
};

// Miles con espacio + símbolo + código (ej. "4 750 CUP"): igual que el resto
// de la app espera, y evita el ambiguo "$" solo cuando decimalPlaces=0
// (pesos enteros) para no confundir con USD.
export function fmt(n: number, currency: WebstoreCurrency = DEFAULT_CURRENCY): string {
  const rounded =
    currency.decimalPlaces > 0
      ? n.toFixed(currency.decimalPlaces)
      : Math.round(n).toString();
  const [intPart, decimalPart] = rounded.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const amount = decimalPart ? `${withThousands}.${decimalPart}` : withThousands;
  return `${amount} ${currency.code}`;
}

/** Normaliza para búsqueda: minúsculas y sin acentos ("azucar" encuentra "Azúcar"). */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function discountPct(product: WebstoreProduct): number {
  if (product.compareAtPrice == null || product.compareAtPrice <= 0) return 0;
  return Math.round(
    ((product.compareAtPrice - product.price) / product.compareAtPrice) * 100
  );
}

export interface StockInfo {
  label: string;
  color: string;
}

export function stockInfo(stockAvailable: number): StockInfo {
  if (stockAvailable <= 0) {
    return { label: "Agotado", color: "#B54A5E" };
  }
  if (stockAvailable < 10) {
    return {
      label: `Pocas unidades · quedan ${stockAvailable}`,
      color: "#B07B2E",
    };
  }
  return { label: "En stock", color: "#1E7A4F" };
}
