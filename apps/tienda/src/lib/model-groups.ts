import type {
  WebstoreProduct,
  WebstoreProductPiece,
  WebstoreProductPresentation,
} from "@/lib/erp-client";
import { syntheticBasePresentation } from "@/lib/catalog-sanitize";
import { discountPct, normalizeText } from "@/lib/format";
import type { CartLine } from "@/lib/store";

// Agrupación en cliente del catálogo plano del ERP (una fila por modelo/SKU)
// en "entradas": una card por grupo de modelos o por producto suelto. Todo es
// puro y determinista (sin Date ni random) para que servidor y cliente pinten
// lo mismo y no haya mismatch de hidratación.

export interface CatalogEntry {
  /** "g:<groupId>" para grupos, "p:<sku>" para productos sueltos. */
  key: string;
  /** Título de la card: nombre del grupo o del producto. */
  name: string;
  optionLabel: string;
  /** Modelos ordenados por sortOrder y luego etiqueta (orden numérico natural). */
  models: WebstoreProduct[];
  /** Modelo preseleccionado en la card. */
  primary: WebstoreProduct;
}

export type PreferModel = "offer" | "stock";

export interface GroupCatalogOptions {
  /** Criterio para el modelo preseleccionado: "offer" con el filtro Ofertas, "stock" con "En stock". */
  prefer?: PreferModel;
}

const DEFAULT_OPTION_LABEL = "Modelo";

export function hasStock(product: Pick<WebstoreProduct, "stockAvailable">): boolean {
  return product.stockAvailable > 0;
}

export function hasOffer(product: Pick<WebstoreProduct, "compareAtPrice">): boolean {
  return product.compareAtPrice != null;
}

export function compareModels(a: WebstoreProduct, b: WebstoreProduct): number {
  const orderA = a.modelGroup?.sortOrder ?? 0;
  const orderB = b.modelGroup?.sortOrder ?? 0;
  if (orderA !== orderB) return orderA - orderB;
  const labelA = a.modelGroup?.modelLabel ?? a.name;
  const labelB = b.modelGroup?.modelLabel ?? b.name;
  return labelA.localeCompare(labelB, "es", { numeric: true });
}

/**
 * Modelo por defecto de una card: el preferido por el filtro activo, si no el
 * primero con stock, si no el primero. Determinista.
 */
export function pickDefault(models: WebstoreProduct[], prefer?: PreferModel): WebstoreProduct {
  if (prefer === "offer") {
    const offered = models.find((m) => hasOffer(m) && hasStock(m)) ?? models.find(hasOffer);
    if (offered) return offered;
  }
  return models.find(hasStock) ?? models[0];
}

/** Nombre a mostrar: "Grupo · Etiqueta" (o solo el grupo) para modelos; el nombre del producto si está suelto. */
export function displayName(product: WebstoreProduct, withLabel = true): string {
  const group = product.modelGroup;
  if (!group) return product.name;
  return withLabel ? `${group.name} · ${group.modelLabel}` : group.name;
}

export function groupCatalog(
  products: WebstoreProduct[],
  options: GroupCatalogOptions = {}
): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  const byGroup = new Map<number, CatalogEntry>();
  for (const product of products) {
    const group = product.modelGroup;
    if (!group) {
      entries.push(looseEntry(product));
      continue;
    }
    const existing = byGroup.get(group.groupId);
    if (existing) {
      existing.models.push(product);
      continue;
    }
    const entry: CatalogEntry = {
      key: `g:${group.groupId}`,
      name: group.name,
      optionLabel: group.optionLabel || DEFAULT_OPTION_LABEL,
      models: [product],
      primary: product,
    };
    byGroup.set(group.groupId, entry);
    entries.push(entry);
  }
  return entries.map((entry) => {
    // Un grupo con un solo modelo publicable se comporta como producto suelto.
    if (entry.models.length === 1) return looseEntry(entry.models[0]);
    const models = [...entry.models].sort(compareModels);
    return { ...entry, models, primary: pickDefault(models, options.prefer) };
  });
}

function looseEntry(product: WebstoreProduct): CatalogEntry {
  return {
    key: `p:${product.sku}`,
    name: displayName(product, true),
    optionLabel: product.modelGroup?.optionLabel || DEFAULT_OPTION_LABEL,
    models: [product],
    primary: product,
  };
}

/** Todos los modelos del grupo de `product` (incluido él), ordenados. `[product]` si está suelto. */
export function modelSiblings(all: WebstoreProduct[], product: WebstoreProduct): WebstoreProduct[] {
  const groupId = product.modelGroup?.groupId;
  if (groupId == null) return [product];
  const siblings = all.filter((p) => p.modelGroup?.groupId === groupId);
  if (!siblings.some((p) => p.sku === product.sku)) siblings.push(product);
  return siblings.sort(compareModels);
}

// ---- Agregados por entrada (filtros y orden del catálogo) -----------------

export function entryMinPrice(entry: CatalogEntry): number {
  return Math.min(...entry.models.map((m) => m.price));
}

export function entryMaxPrice(entry: CatalogEntry): number {
  return Math.max(...entry.models.map((m) => m.price));
}

export function entryMaxDiscountPct(entry: CatalogEntry): number {
  return Math.max(0, ...entry.models.map(discountPct));
}

export function entryHasStock(entry: CatalogEntry): boolean {
  return entry.models.some(hasStock);
}

export function entryHasOffer(entry: CatalogEntry): boolean {
  return entry.models.some(hasOffer);
}

export function entryIsFeatured(entry: CatalogEntry): boolean {
  return entry.models.some((m) => m.featured);
}

export function entryHasCategory(entry: CatalogEntry, category: string): boolean {
  return entry.models.some((m) => m.category === category);
}

/** ISO 8601 más reciente entre los modelos ("" si ninguno lo trae). */
export function entryNewestCreatedAt(entry: CatalogEntry): string {
  return entry.models.reduce(
    (newest, m) => ((m.createdAt ?? "") > newest ? (m.createdAt ?? "") : newest),
    ""
  );
}

/** Texto normalizado (sin acentos, minúsculas) con nombre, grupo, etiquetas y categorías. */
export function entrySearchText(entry: CatalogEntry): string {
  const parts = new Set<string>([entry.name]);
  for (const m of entry.models) {
    parts.add(m.name);
    if (m.modelGroup) {
      parts.add(m.modelGroup.name);
      parts.add(m.modelGroup.modelLabel);
    }
    if (m.category) parts.add(m.category);
  }
  return normalizeText(Array.from(parts).join(" "));
}

// ---- Formatos (presentaciones) --------------------------------------------

/** Presentaciones con la base primero y el resto en el orden del ERP. Siempre incluye una base. */
export function sortedPresentations(product: WebstoreProduct): WebstoreProductPresentation[] {
  const sorted = [...product.presentations].sort(
    (a, b) => Number(b.isBase) - Number(a.isBase)
  );
  if (!sorted.some((pr) => pr.isBase)) {
    sorted.unshift(syntheticBasePresentation(product));
  }
  return sorted;
}

export function basePresentation(product: WebstoreProduct): WebstoreProductPresentation {
  return sortedPresentations(product)[0];
}

/**
 * Un formato se puede añadir si hay stock para una unidad completa
 * (stockAvailable >= factor). En catch-weight el stock está en kg y basta con
 * stock > 0 (flujo estimado: el peso real se captura al preparar el pedido);
 * solo cuando hay pesajes registrados las presentaciones por pieza exigen
 * stockPieces >= piecesPerUnit, porque entonces el cliente compra piezas
 * contadas y no una estimación.
 */
export function formatAvailable(
  product: WebstoreProduct,
  presentation: WebstoreProductPresentation
): boolean {
  if (product.stockAvailable <= 0) return false;
  if (product.isCatchWeight) {
    if (presentation.isBase) return true;
    const hasRegisteredPieces = (product.pieces?.length ?? 0) > 0;
    if (
      hasRegisteredPieces &&
      presentation.piecesPerUnit != null &&
      presentation.stockPieces != null
    ) {
      return presentation.stockPieces >= presentation.piecesPerUnit;
    }
    return true;
  }
  return product.stockAvailable >= presentation.factor;
}

/**
 * Pesajes registrados que casan con el formato (pieceCount = piecesPerUnit) y
 * tienen precio del ERP. Si hay alguno, el cliente debe elegir la pieza exacta
 * (paga su peso real) en lugar de añadir el formato a precio estimado.
 */
export function matchingPieces(
  product: WebstoreProduct,
  presentation: WebstoreProductPresentation
): WebstoreProductPiece[] {
  if (!product.isCatchWeight || !product.pieces?.length) return [];
  const piecesPerUnit = presentation.piecesPerUnit;
  if (piecesPerUnit == null) return [];
  return product.pieces.filter(
    (p) => p.pieceCount === piecesPerUnit && p.price != null
  );
}

export function formatRequiresPieceChoice(
  product: WebstoreProduct,
  presentation: WebstoreProductPresentation
): boolean {
  return matchingPieces(product, presentation).length > 0;
}

/** Precio a mostrar/cobrar del formato: el efectivo del ERP; en catch-weight, el estimado (precio/kg × peso nominal). */
export function formatPrice(
  product: WebstoreProduct,
  presentation: WebstoreProductPresentation
): number {
  if (product.isCatchWeight && presentation.estimatedPrice != null) {
    return presentation.estimatedPrice;
  }
  return presentation.price;
}

/**
 * Precio antes del descuento del formato, o null si no está rebajado. En
 * catch-weight el ERP solo manda compareAtPrice a nivel producto (por kg): la
 * base lo usa tal cual y las presentaciones por pieza lo estiman con el peso
 * nominal, igual que su precio.
 */
export function formatCompareAtPrice(
  product: WebstoreProduct,
  presentation: WebstoreProductPresentation
): number | null {
  const price = formatPrice(product, presentation);
  let compareAt: number | null;
  if (!product.isCatchWeight) {
    compareAt = presentation.compareAtPrice;
  } else if (presentation.isBase) {
    compareAt = product.compareAtPrice;
  } else if (product.compareAtPrice != null && presentation.nominalWeightKg != null) {
    compareAt = product.compareAtPrice * presentation.nominalWeightKg;
  } else {
    compareAt = null;
  }
  return compareAt != null && compareAt > price ? compareAt : null;
}

export function formatDiscountPct(
  product: WebstoreProduct,
  presentation: WebstoreProductPresentation
): number {
  const compareAt = formatCompareAtPrice(product, presentation);
  if (compareAt == null || compareAt <= 0) return 0;
  return Math.round(((compareAt - formatPrice(product, presentation)) / compareAt) * 100);
}

/** Línea de carrito única para (modelo, formato). El sku es el del formato: es el que va al ERP. */
export function cartLineFor(
  model: WebstoreProduct,
  presentation: WebstoreProductPresentation
): CartLine {
  return {
    sku: presentation.sku,
    productSku: model.sku,
    name: displayName(model, true),
    presentationName: presentation.isBase ? null : presentation.name,
    unitPrice: formatPrice(model, presentation),
    qty: 1,
    imageUrl: model.imageUrl,
    stockAvailable: model.stockAvailable,
    ...(model.modelGroup ? { modelLabel: model.modelGroup.modelLabel } : {}),
    ...(model.isCatchWeight ? { isCatchWeight: true } : {}),
    ...(model.pricePerKg != null ? { pricePerKg: model.pricePerKg } : {}),
  };
}
