import type { WebstoreCurrency, WebstoreProduct } from "@/lib/erp-client";

/** Fallback antes de que cargue el catálogo (ver store.tsx): CUP, 0 decimales, igual que getBaseCurrency en el ERP. */
export const DEFAULT_CURRENCY: WebstoreCurrency = {
  code: "CUP",
  symbol: "$",
  decimalPlaces: 0,
};

// Miles con espacio + código (ej. "4 750 CUP"): evita el ambiguo "$" solo.
// Los decimales reales siempre se muestran ("250.50 CUP") aunque la moneda
// declare 0 decimales (estimados catch-weight, etc.); se omiten solo cuando
// son todo ceros ("250 CUP", nunca "250.00 CUP").
export function fmt(n: number, currency: WebstoreCurrency = DEFAULT_CURRENCY): string {
  const decimals = Math.max(2, currency.decimalPlaces);
  const [intPart, decimalPart] = n.toFixed(decimals).split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const amount =
    decimalPart && Number(decimalPart) !== 0
      ? `${withThousands}.${decimalPart}`
      : withThousands;
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
