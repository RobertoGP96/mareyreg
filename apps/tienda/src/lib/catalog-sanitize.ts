import type {
  CatalogResponse,
  WebstoreModelGroup,
  WebstoreProduct,
  WebstoreProductPresentation,
} from "@/lib/erp-client";

// Tolerancia al desfase de deploy tienda/ERP (2 proyectos Vercel, nunca
// atómico): un ERP viejo puede mandar productos sin sku, sin createdAt, sin
// pieces, sin modelGroup o presentaciones sin `price`. Se sanea aquí, en un
// solo lugar y sin dependencias de servidor, para poder probarlo en vitest.

type RawPresentation = Omit<WebstoreProductPresentation, "price" | "compareAtPrice"> & {
  price?: number | null;
  compareAtPrice?: number | null;
};

export type RawCatalogProduct = Omit<
  WebstoreProduct,
  "sku" | "createdAt" | "pieces" | "modelGroup" | "presentations"
> & {
  sku?: unknown;
  createdAt?: string | null;
  pieces?: WebstoreProduct["pieces"];
  modelGroup?: WebstoreModelGroup | null;
  presentations?: RawPresentation[] | null;
};

export type RawCatalogResponse = Omit<CatalogResponse, "products"> & {
  products?: RawCatalogProduct[] | null;
};

/**
 * Presentación base virtual para un producto cuyo catálogo no la trae (ERP
 * anterior a PR1, que omitía la base sin sku). Vende con el SKU del producto,
 * que el ERP resuelve a la base.
 */
export function syntheticBasePresentation(
  product: Pick<WebstoreProduct, "sku" | "price" | "compareAtPrice">
): WebstoreProductPresentation {
  return {
    sku: product.sku,
    name: "unidad",
    factor: 1,
    retailPrice: product.price,
    wholesalePrice: null,
    barcode: null,
    isBase: true,
    piecesPerUnit: null,
    nominalWeightKg: null,
    estimatedPrice: null,
    stockPieces: null,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
  };
}

function sanitizePresentation(
  pr: RawPresentation,
  product: Pick<WebstoreProduct, "price" | "compareAtPrice">
): WebstoreProductPresentation {
  const { price, compareAtPrice, ...rest } = pr;
  if (typeof price === "number") {
    return {
      ...rest,
      price,
      compareAtPrice: typeof compareAtPrice === "number" ? compareAtPrice : null,
    };
  }
  // ERP viejo sin `price`: la base cuesta lo que el producto (precio efectivo,
  // con descuento y moneda); para el resto solo existe el retailPrice crudo.
  return rest.isBase
    ? { ...rest, price: product.price, compareAtPrice: product.compareAtPrice }
    : { ...rest, price: rest.retailPrice, compareAtPrice: null };
}

function sanitizeModelGroup(
  group: WebstoreModelGroup | null | undefined
): WebstoreModelGroup | null {
  if (
    group == null ||
    typeof group.groupId !== "number" ||
    typeof group.name !== "string" ||
    typeof group.modelLabel !== "string"
  ) {
    return null;
  }
  return {
    groupId: group.groupId,
    name: group.name,
    optionLabel:
      typeof group.optionLabel === "string" && group.optionLabel.length > 0
        ? group.optionLabel
        : "Modelo",
    modelLabel: group.modelLabel,
    sortOrder: typeof group.sortOrder === "number" ? group.sortOrder : 0,
  };
}

export function sanitizeProduct(raw: RawCatalogProduct & { sku: string }): WebstoreProduct {
  const { sku, createdAt, pieces, modelGroup, presentations, ...rest } = raw;
  const cleanPresentations = (presentations ?? []).map((pr) =>
    sanitizePresentation(pr, rest)
  );
  const product: WebstoreProduct = {
    ...rest,
    sku,
    createdAt: createdAt ?? "",
    // ERP viejo sin registro de pesajes: pieces ausente se sanea a [] en
    // catch-weight (flujo estimado) y null en productos normales.
    pieces: pieces === undefined ? (rest.isCatchWeight ? [] : null) : pieces,
    modelGroup: sanitizeModelGroup(modelGroup),
    presentations: cleanPresentations,
  };
  if (!cleanPresentations.some((pr) => pr.isBase)) {
    product.presentations = [syntheticBasePresentation(product), ...cleanPresentations];
  }
  return product;
}

export function sanitizeCatalog(raw: RawCatalogResponse): CatalogResponse {
  return {
    ...raw,
    products: (raw.products ?? [])
      .filter((p): p is RawCatalogProduct & { sku: string } =>
        typeof p.sku === "string" && p.sku.length > 0
      )
      .map(sanitizeProduct),
  };
}
