import {
  lineKey,
  type EffectiveLineInput,
  type EffectiveLinePriceResult,
} from "@/modules/inventory/lib/effective-price";
import { piecePrice } from "./piece-price";

/** Máximo de pesajes expuestos por producto en el catálogo. */
export const MAX_PIECES_PER_PRODUCT = 50;

/** Decimal de Prisma, number o string: todo se normaliza con Number(). */
type DecimalLike = number | string | { toString(): string };
const num = (value: DecimalLike): number => Number(value);

export interface CatalogPresentationSource {
  presentationId: number;
  sku: string | null;
  name: string;
  factor: DecimalLike;
  retailPrice: DecimalLike;
  wholesalePrice: DecimalLike | null;
  barcode: string | null;
  isBase: boolean;
  piecesPerUnit: number | null;
}

export interface CatalogModelGroupSource {
  groupId: number;
  name: string;
  optionLabel: string;
}

export interface CatalogProductSource {
  productId: number;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  webstoreFeatured: boolean;
  imageUrl: string | null;
  createdAt: Date;
  isCatchWeight: boolean;
  modelLabel: string | null;
  modelSortOrder: number;
  modelGroup: CatalogModelGroupSource | null;
  stockLevels: Array<{ currentQuantity: DecimalLike; currentPieces: number | null }>;
  presentations: CatalogPresentationSource[];
}

export interface CatalogPieceSource {
  pieceId: number;
  productId: number;
  weightKg: DecimalLike;
  pieceCount: number;
}

export interface WebstoreOfferPayload {
  name: string;
  type: "percent" | "fixed";
  value: number;
  endsAt: string | null;
}

export interface WebstoreCatalogPresentation {
  sku: string;
  name: string;
  factor: number;
  /** Precio de lista crudo de la presentación (sin descuento ni conversión). Heredado: usar `price`. */
  retailPrice: number;
  wholesalePrice: number | null;
  barcode: string | null;
  isBase: boolean;
  piecesPerUnit: number | null;
  nominalWeightKg: number | null;
  estimatedPrice: number | null;
  stockPieces: number | null;
  /** Precio efectivo (descuentos aplicados, moneda base): el mismo que factura el ERP. */
  price: number;
  /** Precio antes del descuento cuando `price` está rebajado; null si no hay descuento. */
  compareAtPrice: number | null;
}

export interface WebstoreCatalogModelGroup {
  groupId: number;
  name: string;
  optionLabel: string;
  modelLabel: string;
  sortOrder: number;
}

export interface WebstoreCatalogPiece {
  pieceId: number;
  weightKg: number;
  pieceCount: number;
  price: number | null;
}

export interface WebstoreCatalogProduct {
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  compareAtPrice: number | null;
  featured: boolean;
  stockAvailable: number;
  imageUrl: string | null;
  createdAt: string;
  offer: WebstoreOfferPayload | null;
  isCatchWeight: boolean;
  pricePerKg: number | null;
  pieces: WebstoreCatalogPiece[] | null;
  modelGroup: WebstoreCatalogModelGroup | null;
  presentations: WebstoreCatalogPresentation[];
}

export interface CatalogMapperContext {
  prices: Map<string, EffectiveLinePriceResult>;
  offerByDiscountId: Map<number, WebstoreOfferPayload>;
  piecesByProductId: Map<number, CatalogPieceSource[]>;
  decimalPlaces: number;
}

const EMPTY_PRICE: EffectiveLinePriceResult = {
  basePrice: 0,
  finalPrice: 0,
  appliedDiscounts: [],
  factor: 1,
  pricePerBase: undefined,
};

type PublishablePresentation = CatalogPresentationSource & { sku: string };

/**
 * Presentaciones que la tienda puede vender: las que tienen SKU propio y la
 * base, que se vende con el SKU del producto (resolveSkusBatch resuelve ese
 * SKU a la base). Sin esto la base creada por createProduct (sin sku) quedaba
 * fuera del catálogo y el selector de formato salía incompleto.
 */
export function publishablePresentations(
  product: Pick<CatalogProductSource, "sku" | "presentations">
): PublishablePresentation[] {
  const result: PublishablePresentation[] = [];
  for (const pr of product.presentations) {
    if (pr.sku != null) {
      result.push({ ...pr, sku: pr.sku });
    } else if (pr.isBase) {
      result.push({ ...pr, sku: product.sku });
    }
  }
  return result;
}

/**
 * Una línea base por producto (precio de la card) más una por presentación
 * no-base publicable, para que el precio de cada formato salga del mismo
 * helper que usa la facturación (descuentos y conversión incluidos).
 */
export function catalogPriceLines(products: CatalogProductSource[]): EffectiveLineInput[] {
  const lines: EffectiveLineInput[] = [];
  for (const p of products) {
    lines.push({ productId: p.productId, quantity: 1 });
    for (const pr of publishablePresentations(p)) {
      if (!pr.isBase) {
        lines.push({ productId: p.productId, presentationId: pr.presentationId, quantity: 1 });
      }
    }
  }
  return lines;
}

export function groupPiecesByProduct(
  pieces: CatalogPieceSource[],
  maxPerProduct = MAX_PIECES_PER_PRODUCT
): Map<number, CatalogPieceSource[]> {
  const byProduct = new Map<number, CatalogPieceSource[]>();
  for (const piece of pieces) {
    const list = byProduct.get(piece.productId);
    if (list) {
      if (list.length < maxPerProduct) list.push(piece);
    } else {
      byProduct.set(piece.productId, [piece]);
    }
  }
  return byProduct;
}

export function toCatalogProduct(
  p: CatalogProductSource,
  ctx: CatalogMapperContext
): WebstoreCatalogProduct {
  const price = ctx.prices.get(lineKey(p.productId)) ?? EMPTY_PRICE;
  const appliedDiscountId = price.appliedDiscounts[0]?.discountId;
  const offer =
    appliedDiscountId != null ? (ctx.offerByDiscountId.get(appliedDiscountId) ?? null) : null;
  const stockAvailable = p.stockLevels.reduce((sum, s) => sum + num(s.currentQuantity), 0);
  const stockPieces = p.stockLevels.reduce((sum, s) => sum + (s.currentPieces ?? 0), 0);
  // Precio por kg (solo catch-weight): fuente de verdad de estimatedPrice y
  // del precio de cada pesaje.
  const pricePerKg = p.isCatchWeight ? (price.pricePerBase ?? null) : null;

  const presentations: WebstoreCatalogPresentation[] = publishablePresentations(p).map((pr) => {
    const linePrice = pr.isBase
      ? price
      : (ctx.prices.get(lineKey(p.productId, pr.presentationId)) ?? EMPTY_PRICE);
    const nominalWeightKg = p.isCatchWeight ? num(pr.factor) : null;
    const estimatedPrice =
      p.isCatchWeight && pricePerKg != null && nominalWeightKg != null
        ? pricePerKg * nominalWeightKg
        : null;
    // Catch-weight se cobra por kg: el precio del formato es la estimación
    // (precio/kg × peso nominal), nunca el retailPrice de la presentación.
    const effective = p.isCatchWeight ? (estimatedPrice ?? linePrice.finalPrice) : linePrice.finalPrice;
    const compareAtPrice =
      !p.isCatchWeight && linePrice.finalPrice < linePrice.basePrice ? linePrice.basePrice : null;
    return {
      sku: pr.sku,
      name: pr.name,
      factor: num(pr.factor),
      retailPrice: num(pr.retailPrice),
      wholesalePrice: pr.wholesalePrice != null ? num(pr.wholesalePrice) : null,
      barcode: pr.barcode,
      isBase: pr.isBase,
      piecesPerUnit: pr.piecesPerUnit,
      nominalWeightKg,
      estimatedPrice,
      stockPieces: p.isCatchWeight ? stockPieces : null,
      price: effective,
      compareAtPrice,
    };
  });

  return {
    sku: p.sku,
    name: p.name,
    description: p.description,
    category: p.category,
    price: price.finalPrice,
    compareAtPrice: price.finalPrice < price.basePrice ? price.basePrice : null,
    featured: p.webstoreFeatured,
    stockAvailable,
    imageUrl: p.imageUrl,
    createdAt: p.createdAt.toISOString(),
    offer,
    isCatchWeight: p.isCatchWeight,
    pricePerKg,
    // Pesajes con precio YA redondeado por el ERP (piecePrice): la tienda
    // nunca recalcula. null en productos normales; [] cuando el producto
    // catch-weight no tiene piezas registradas (flujo estimado).
    pieces: p.isCatchWeight
      ? (ctx.piecesByProductId.get(p.productId) ?? []).map((pz) => ({
          pieceId: pz.pieceId,
          weightKg: num(pz.weightKg),
          pieceCount: pz.pieceCount,
          price:
            pricePerKg != null ? piecePrice(pricePerKg, num(pz.weightKg), ctx.decimalPlaces) : null,
        }))
      : null,
    modelGroup:
      p.modelGroup != null && p.modelLabel != null
        ? {
            groupId: p.modelGroup.groupId,
            name: p.modelGroup.name,
            optionLabel: p.modelGroup.optionLabel,
            modelLabel: p.modelLabel,
            sortOrder: p.modelSortOrder,
          }
        : null,
    presentations,
  };
}
