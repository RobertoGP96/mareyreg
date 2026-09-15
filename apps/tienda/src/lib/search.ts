import type { WebstoreCurrency, WebstoreProduct } from "@/lib/erp-client";
import { normalizeText } from "@/lib/format";
import { displayName } from "@/lib/model-groups";

export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_RESULTS = 8;

/** Fila ligera para el popover del navbar: solo lo que se pinta. */
export interface SearchResult {
  sku: string;
  /** Nombre a mostrar: "Grupo · Etiqueta" en modelos agrupados. */
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
// El nombre considera el nombre interno del producto y, en modelos agrupados,
// el nombre del grupo y la etiqueta ("camiseta l" encuentra "Camiseta · L").
// null = no coincide.
function relevance(product: WebstoreProduct, term: string): number | null {
  const names = [normalizeText(displayName(product, true))];
  if (product.modelGroup) {
    names.push(normalizeText(product.name));
    names.push(
      normalizeText(`${product.modelGroup.name} ${product.modelGroup.modelLabel}`)
    );
  }
  if (names.some((name) => name.startsWith(term))) return 0;
  if (names.some((name) => name.includes(term))) return 1;
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
    .map((product) => ({
      product,
      name: displayName(product, true),
      score: relevance(product, term),
    }))
    .filter(
      (m): m is { product: WebstoreProduct; name: string; score: number } =>
        m.score !== null
    )
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, "es"));

  return {
    total: matched.length,
    results: matched.slice(0, MAX_SEARCH_RESULTS).map(({ product, name }) => ({
      sku: product.sku,
      name,
      category: product.category,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      imageUrl: product.imageUrl,
      stockAvailable: product.stockAvailable,
    })),
  };
}
