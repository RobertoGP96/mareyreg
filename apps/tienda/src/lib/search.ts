import type { WebstoreCurrency, WebstoreProduct } from "@/lib/erp-client";
import { normalizeText } from "@/lib/format";

export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_RESULTS = 8;

/** Fila ligera para el popover del navbar: solo lo que se pinta. */
export interface SearchResult {
  sku: string;
  name: string;
  category: string | null;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  stockAvailable: number;
}

export interface SearchResponse {
  currency: WebstoreCurrency;
  results: SearchResult[];
  total: number;
}

// Relevancia: prefijo del nombre < nombre contiene < categoría contiene.
// null = no coincide.
function relevance(product: WebstoreProduct, term: string): number | null {
  const name = normalizeText(product.name);
  if (name.startsWith(term)) return 0;
  if (name.includes(term)) return 1;
  if (product.category && normalizeText(product.category).includes(term)) {
    return 2;
  }
  return null;
}

export function searchProducts(
  products: WebstoreProduct[],
  rawTerm: string
): { results: SearchResult[]; total: number } {
  const term = normalizeText(rawTerm.trim());
  if (term.length < MIN_SEARCH_LENGTH) return { results: [], total: 0 };

  const matched = products
    .map((product) => ({ product, score: relevance(product, term) }))
    .filter(
      (m): m is { product: WebstoreProduct; score: number } => m.score !== null
    )
    .sort(
      (a, b) =>
        a.score - b.score || a.product.name.localeCompare(b.product.name, "es")
    );

  return {
    total: matched.length,
    results: matched.slice(0, MAX_SEARCH_RESULTS).map(({ product }) => ({
      sku: product.sku,
      name: product.name,
      category: product.category,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      imageUrl: product.imageUrl,
      stockAvailable: product.stockAvailable,
    })),
  };
}
