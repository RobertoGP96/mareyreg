import { describe, it, expect } from "vitest";
import { lineKey, type EffectiveLinePriceResult } from "@/modules/inventory/lib/effective-price";
import {
  catalogPriceLines,
  groupPiecesByProduct,
  publishablePresentations,
  toCatalogProduct,
  type CatalogMapperContext,
  type CatalogProductSource,
} from "./catalog-mappers";

function priceResult(overrides: Partial<EffectiveLinePriceResult> = {}): EffectiveLinePriceResult {
  return {
    basePrice: 100,
    finalPrice: 100,
    appliedDiscounts: [],
    factor: 1,
    pricePerBase: undefined,
    ...overrides,
  };
}

function product(overrides: Partial<CatalogProductSource> = {}): CatalogProductSource {
  return {
    productId: 1,
    sku: "CAM-M",
    name: "Camiseta básica M",
    description: null,
    category: "ropa",
    webstoreFeatured: false,
    imageUrl: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    isCatchWeight: false,
    modelLabel: null,
    modelSortOrder: 0,
    modelGroup: null,
    stockLevels: [{ currentQuantity: "12", currentPieces: null }],
    presentations: [
      {
        presentationId: 10,
        sku: null,
        name: "unidad",
        factor: 1,
        retailPrice: "100",
        wholesalePrice: null,
        barcode: null,
        isBase: true,
        piecesPerUnit: null,
      },
      {
        presentationId: 11,
        sku: "CAM-M-CAJA",
        name: "Caja 12",
        factor: 12,
        retailPrice: "1100",
        wholesalePrice: "1000",
        barcode: null,
        isBase: false,
        piecesPerUnit: null,
      },
    ],
    ...overrides,
  };
}

function context(overrides: Partial<CatalogMapperContext> = {}): CatalogMapperContext {
  return {
    prices: new Map(),
    offerByDiscountId: new Map(),
    piecesByProductId: new Map(),
    decimalPlaces: 0,
    ...overrides,
  };
}

describe("publishablePresentations", () => {
  it("emite la base sin SKU con el SKU del producto y omite no-base sin SKU", () => {
    const p = product({
      presentations: [
        ...product().presentations,
        {
          presentationId: 12,
          sku: null,
          name: "Paquete 3",
          factor: 3,
          retailPrice: "290",
          wholesalePrice: null,
          barcode: null,
          isBase: false,
          piecesPerUnit: null,
        },
      ],
    });
    const result = publishablePresentations(p);
    expect(result.map((r) => [r.presentationId, r.sku])).toEqual([
      [10, "CAM-M"],
      [11, "CAM-M-CAJA"],
    ]);
  });
});

describe("catalogPriceLines", () => {
  it("pide una línea base por producto y una por presentación no-base publicable", () => {
    const lines = catalogPriceLines([product(), product({ productId: 2, sku: "OTRO", presentations: [] })]);
    expect(lines).toEqual([
      { productId: 1, quantity: 1 },
      { productId: 1, presentationId: 11, quantity: 1 },
      { productId: 2, quantity: 1 },
    ]);
  });
});

describe("groupPiecesByProduct", () => {
  it("agrupa por producto respetando el máximo por producto", () => {
    const pieces = [1, 2, 3].map((pieceId) => ({ pieceId, productId: 7, weightKg: "1", pieceCount: 1 }));
    const grouped = groupPiecesByProduct(pieces, 2);
    expect(grouped.get(7)?.map((p) => p.pieceId)).toEqual([1, 2]);
  });
});

describe("toCatalogProduct", () => {
  it("mapea un producto suelto con precio efectivo por presentación", () => {
    const prices = new Map([
      [lineKey(1), priceResult({ basePrice: 100, finalPrice: 90, appliedDiscounts: [{ discountId: 5, name: "Oferta", discountAmount: 10 }] })],
      [lineKey(1, 11), priceResult({ basePrice: 1100, finalPrice: 990, factor: 12 })],
    ]);
    const offerByDiscountId = new Map([[5, { name: "Rebajas", type: "percent" as const, value: 10, endsAt: null }]]);
    const out = toCatalogProduct(product(), context({ prices, offerByDiscountId }));

    expect(out.modelGroup).toBeNull();
    expect(out.price).toBe(90);
    expect(out.compareAtPrice).toBe(100);
    expect(out.offer?.name).toBe("Rebajas");
    expect(out.stockAvailable).toBe(12);
    expect(out.pieces).toBeNull();
    expect(out.presentations).toHaveLength(2);
    const [base, caja] = out.presentations;
    expect(base).toMatchObject({ sku: "CAM-M", isBase: true, price: 90, compareAtPrice: 100, retailPrice: 100 });
    expect(caja).toMatchObject({ sku: "CAM-M-CAJA", isBase: false, factor: 12, price: 990, compareAtPrice: 1100, retailPrice: 1100, wholesalePrice: 1000 });
  });

  it("emite modelGroup cuando el producto pertenece a un grupo", () => {
    const out = toCatalogProduct(
      product({
        modelLabel: "M",
        modelSortOrder: 2,
        modelGroup: { groupId: 7, name: "Camiseta básica", optionLabel: "Talla" },
      }),
      context({ prices: new Map([[lineKey(1), priceResult()]]) })
    );
    expect(out.modelGroup).toEqual({
      groupId: 7,
      name: "Camiseta básica",
      optionLabel: "Talla",
      modelLabel: "M",
      sortOrder: 2,
    });
  });

  it("no emite modelGroup si falta la etiqueta (dato inconsistente)", () => {
    const out = toCatalogProduct(
      product({ modelGroup: { groupId: 7, name: "X", optionLabel: "Modelo" }, modelLabel: null }),
      context()
    );
    expect(out.modelGroup).toBeNull();
  });

  it("catch-weight: precio del formato es el estimado y los pesajes llevan precio redondeado", () => {
    const prices = new Map([[lineKey(3), priceResult({ basePrice: 20, finalPrice: 20, pricePerBase: 20 })]]);
    const piecesByProductId = new Map([[3, [{ pieceId: 501, productId: 3, weightKg: "3.2", pieceCount: 1 }]]]);
    const out = toCatalogProduct(
      product({
        productId: 3,
        sku: "QUESO",
        isCatchWeight: true,
        stockLevels: [{ currentQuantity: "10", currentPieces: 4 }],
        presentations: [
          { presentationId: 30, sku: null, name: "kg", factor: 1, retailPrice: "20", wholesalePrice: null, barcode: null, isBase: true, piecesPerUnit: null },
          { presentationId: 31, sku: "QUESO-PZA", name: "Pieza", factor: "2.5", retailPrice: "50", wholesalePrice: null, barcode: null, isBase: false, piecesPerUnit: 1 },
        ],
      }),
      context({ prices, piecesByProductId })
    );
    expect(out.pricePerKg).toBe(20);
    expect(out.pieces).toEqual([{ pieceId: 501, weightKg: 3.2, pieceCount: 1, price: 64 }]);
    const pieza = out.presentations.find((pr) => pr.sku === "QUESO-PZA");
    expect(pieza).toMatchObject({ nominalWeightKg: 2.5, estimatedPrice: 50, price: 50, compareAtPrice: null, stockPieces: 4 });
  });

  it("sin precio calculado cae a 0 sin romper", () => {
    const out = toCatalogProduct(product(), context());
    expect(out.price).toBe(0);
    expect(out.presentations[1].price).toBe(0);
  });
});
