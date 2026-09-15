import { describe, expect, it } from "vitest";
import type {
  WebstoreModelGroup,
  WebstoreProduct,
  WebstoreProductPresentation,
} from "@/lib/erp-client";
import { sanitizeCatalog } from "@/lib/catalog-sanitize";
import {
  cartLineFor,
  displayName,
  entryHasOffer,
  entryHasStock,
  entryMinPrice,
  entrySearchText,
  formatAvailable,
  formatCompareAtPrice,
  formatDiscountPct,
  formatPrice,
  formatRequiresPieceChoice,
  groupCatalog,
  modelSiblings,
  pickDefault,
  sortedPresentations,
} from "@/lib/model-groups";

function presentation(
  overrides: Partial<WebstoreProductPresentation> & { sku: string }
): WebstoreProductPresentation {
  return {
    name: "unidad",
    factor: 1,
    retailPrice: 100,
    wholesalePrice: null,
    barcode: null,
    isBase: false,
    piecesPerUnit: null,
    nominalWeightKg: null,
    estimatedPrice: null,
    stockPieces: null,
    price: 100,
    compareAtPrice: null,
    ...overrides,
  };
}

function product(
  overrides: Partial<WebstoreProduct> & { sku: string }
): WebstoreProduct {
  const base: WebstoreProduct = {
    name: overrides.sku,
    description: null,
    category: "Ropa",
    price: 100,
    compareAtPrice: null,
    featured: false,
    stockAvailable: 10,
    imageUrl: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    presentations: [],
    offer: null,
    isCatchWeight: false,
    pricePerKg: null,
    pieces: null,
    modelGroup: null,
    ...overrides,
  };
  if (base.presentations.length === 0) {
    base.presentations = [
      presentation({ sku: base.sku, isBase: true, price: base.price, retailPrice: base.price }),
    ];
  }
  return base;
}

function group(
  modelLabel: string,
  sortOrder = 0,
  groupId = 7
): WebstoreModelGroup {
  return { groupId, name: "Camiseta básica", optionLabel: "Talla", modelLabel, sortOrder };
}

const shirtM = product({
  sku: "CAM-M",
  name: "Camiseta básica M",
  price: 950,
  modelGroup: group("M", 1),
});
const shirtL = product({
  sku: "CAM-L",
  name: "Camiseta básica L",
  price: 990,
  compareAtPrice: 1200,
  modelGroup: group("L", 2),
});
const shirtXL = product({
  sku: "CAM-XL",
  name: "Camiseta básica XL",
  price: 1050,
  stockAvailable: 0,
  modelGroup: group("XL", 3),
});
const loose = product({ sku: "SAL-1", name: "Sal fina", price: 50, category: "Despensa" });

describe("groupCatalog", () => {
  it("agrupa modelos del mismo grupo en una entrada y deja sueltos los demás", () => {
    const entries = groupCatalog([loose, shirtL, shirtM, shirtXL]);
    expect(entries.map((e) => e.key)).toEqual(["p:SAL-1", "g:7"]);
    const shirts = entries[1];
    expect(shirts.name).toBe("Camiseta básica");
    expect(shirts.optionLabel).toBe("Talla");
    expect(shirts.models.map((m) => m.sku)).toEqual(["CAM-M", "CAM-L", "CAM-XL"]);
    expect(shirts.primary.sku).toBe("CAM-M");
  });

  it("ordena las etiquetas por sortOrder y luego de forma numérica natural", () => {
    const s2 = product({ sku: "Z-2", modelGroup: group("2", 0, 9) });
    const s10 = product({ sku: "Z-10", modelGroup: group("10", 0, 9) });
    const s1 = product({ sku: "Z-1", modelGroup: group("1", 0, 9) });
    const first = product({ sku: "Z-F", modelGroup: group("Único", 0, 9) });
    const [entry] = groupCatalog([s10, s2, first, s1]);
    expect(entry.models.map((m) => m.modelGroup?.modelLabel)).toEqual(["1", "2", "10", "Único"]);
  });

  it("un grupo con un solo modelo se comporta como producto suelto", () => {
    const [entry] = groupCatalog([shirtM]);
    expect(entry.key).toBe("p:CAM-M");
    expect(entry.name).toBe("Camiseta básica · M");
    expect(entry.models).toHaveLength(1);
  });

  it("preselecciona el primer modelo con stock y, con prefer offer, el rebajado", () => {
    const soldOutFirst = [
      product({ ...shirtM, stockAvailable: 0 }),
      shirtL,
      shirtXL,
    ];
    expect(pickDefault(soldOutFirst).sku).toBe("CAM-L");
    expect(pickDefault([shirtM, shirtL], "offer").sku).toBe("CAM-L");
    expect(pickDefault([shirtM, shirtL]).sku).toBe("CAM-M");
    const [entry] = groupCatalog([shirtM, shirtL], { prefer: "offer" });
    expect(entry.primary.sku).toBe("CAM-L");
    // Todo agotado: el primero, sin lanzar.
    expect(pickDefault([product({ ...shirtM, stockAvailable: 0 })]).sku).toBe("CAM-M");
  });

  it("agregados por entrada", () => {
    const [entry] = groupCatalog([shirtM, shirtL, shirtXL]);
    expect(entryMinPrice(entry)).toBe(950);
    expect(entryHasOffer(entry)).toBe(true);
    expect(entryHasStock(entry)).toBe(true);
    expect(entrySearchText(entry)).toContain("camiseta basica");
    expect(entrySearchText(entry)).toContain("xl");
  });
});

describe("modelSiblings y displayName", () => {
  it("devuelve los modelos del grupo ordenados e incluye al propio producto", () => {
    expect(modelSiblings([loose, shirtXL, shirtM, shirtL], shirtL).map((m) => m.sku)).toEqual([
      "CAM-M",
      "CAM-L",
      "CAM-XL",
    ]);
    expect(modelSiblings([loose], loose)).toEqual([loose]);
  });

  it("displayName usa grupo y etiqueta", () => {
    expect(displayName(shirtM)).toBe("Camiseta básica · M");
    expect(displayName(shirtM, false)).toBe("Camiseta básica");
    expect(displayName(loose)).toBe("Sal fina");
  });
});

describe("formatos", () => {
  const box = presentation({
    sku: "CAM-M-CAJA",
    name: "Caja 12",
    factor: 12,
    price: 10800,
    compareAtPrice: 11400,
    retailPrice: 11400,
  });
  const withBox = product({
    sku: "CAM-M",
    price: 950,
    stockAvailable: 10,
    presentations: [box, presentation({ sku: "CAM-M", isBase: true, price: 950 })],
  });

  it("sortedPresentations pone la base primero", () => {
    expect(sortedPresentations(withBox).map((p) => p.sku)).toEqual(["CAM-M", "CAM-M-CAJA"]);
  });

  it("un formato está disponible solo si stockAvailable >= factor", () => {
    const [base, caja] = sortedPresentations(withBox);
    expect(formatAvailable(withBox, base)).toBe(true);
    expect(formatAvailable(withBox, caja)).toBe(false);
    expect(formatAvailable({ ...withBox, stockAvailable: 12 }, caja)).toBe(true);
    expect(formatAvailable({ ...withBox, stockAvailable: 0 }, base)).toBe(false);
  });

  const cheese = product({
    sku: "QUE-1",
    isCatchWeight: true,
    price: 900,
    compareAtPrice: 1000,
    pricePerKg: 900,
    stockAvailable: 3.5,
    pieces: [],
    presentations: [
      presentation({
        sku: "QUE-1",
        isBase: true,
        price: 900,
        nominalWeightKg: 1,
        estimatedPrice: 900,
      }),
      presentation({
        sku: "QUE-1-CAJA",
        name: "Caja",
        factor: 4,
        piecesPerUnit: 4,
        nominalWeightKg: 4,
        stockPieces: 3,
        price: 3600,
        estimatedPrice: 3600,
      }),
    ],
  });
  const registeredPiece = { pieceId: 501, weightKg: 3.9, pieceCount: 4, price: 3510 };

  it("catch-weight sin pesajes registrados vende por estimación con stock en kg", () => {
    const [base, caja] = sortedPresentations(cheese);
    expect(formatAvailable(cheese, base)).toBe(true);
    expect(formatAvailable(cheese, caja)).toBe(true);
    expect(formatAvailable({ ...cheese, stockAvailable: 0 }, caja)).toBe(false);
    expect(formatPrice(cheese, caja)).toBe(3600);
    expect(formatRequiresPieceChoice(cheese, caja)).toBe(false);
  });

  it("catch-weight con pesajes registrados exige stockPieces >= piecesPerUnit", () => {
    const counted = { ...cheese, pieces: [registeredPiece] };
    const [base, caja] = sortedPresentations(counted);
    expect(formatAvailable(counted, base)).toBe(true);
    expect(formatAvailable(counted, caja)).toBe(false);
    const enough = {
      ...counted,
      presentations: [base, { ...caja, stockPieces: 4 }],
    };
    expect(formatAvailable(enough, sortedPresentations(enough)[1])).toBe(true);
  });

  it("con pesajes que casan con el formato, la card delega la elección de pieza", () => {
    const counted = { ...cheese, pieces: [registeredPiece] };
    const [base, caja] = sortedPresentations(counted);
    expect(formatRequiresPieceChoice(counted, caja)).toBe(true);
    expect(formatRequiresPieceChoice(counted, base)).toBe(false);
    const loosePieceOnly = { ...cheese, pieces: [{ ...registeredPiece, pieceCount: 1 }] };
    expect(formatRequiresPieceChoice(loosePieceOnly, caja)).toBe(false);
  });

  it("catch-weight en oferta conserva tachado y −% (por kg en la base, estimado por pieza)", () => {
    const [base, caja] = sortedPresentations(cheese);
    expect(formatCompareAtPrice(cheese, base)).toBe(1000);
    expect(formatDiscountPct(cheese, base)).toBe(10);
    expect(formatCompareAtPrice(cheese, caja)).toBe(4000);
    expect(formatDiscountPct(cheese, caja)).toBe(10);
    const noOffer = { ...cheese, compareAtPrice: null };
    expect(formatCompareAtPrice(noOffer, sortedPresentations(noOffer)[0])).toBeNull();
    expect(formatDiscountPct(noOffer, sortedPresentations(noOffer)[1])).toBe(0);
  });

  it("formatPrice usa el precio efectivo, nunca retailPrice", () => {
    const [, caja] = sortedPresentations(withBox);
    expect(formatPrice(withBox, caja)).toBe(10800);
  });

  it("cartLineFor: base vs caja producen líneas con sku distinto", () => {
    const grouped = { ...withBox, modelGroup: group("M", 1) };
    const [base, caja] = sortedPresentations(grouped);
    const baseLine = cartLineFor(grouped, base);
    const boxLine = cartLineFor(grouped, caja);
    expect(baseLine).toMatchObject({
      sku: "CAM-M",
      productSku: "CAM-M",
      name: "Camiseta básica · M",
      presentationName: null,
      unitPrice: 950,
      modelLabel: "M",
    });
    expect(boxLine).toMatchObject({
      sku: "CAM-M-CAJA",
      productSku: "CAM-M",
      presentationName: "Caja 12",
      unitPrice: 10800,
      modelLabel: "M",
    });
    expect(cartLineFor(loose, sortedPresentations(loose)[0])).not.toHaveProperty("modelLabel");
  });
});

describe("sanitizeCatalog (ERP viejo)", () => {
  it("rellena modelGroup, price de presentaciones y la base ausente", () => {
    const { products } = sanitizeCatalog({
      currency: { code: "CUP", symbol: "$", decimalPlaces: 0 },
      products: [
        {
          sku: "OLD-1",
          name: "Producto viejo",
          description: null,
          category: null,
          price: 300,
          compareAtPrice: 350,
          featured: false,
          stockAvailable: 5,
          imageUrl: null,
          offer: null,
          isCatchWeight: false,
          pricePerKg: null,
          presentations: [
            {
              sku: "OLD-1-CAJA",
              name: "Caja",
              factor: 6,
              retailPrice: 2000,
              wholesalePrice: null,
              barcode: null,
              isBase: false,
              piecesPerUnit: null,
              nominalWeightKg: null,
              estimatedPrice: null,
              stockPieces: null,
            },
          ],
        },
        { sku: "", name: "Sin sku" } as never,
      ],
    });
    expect(products).toHaveLength(1);
    const [p] = products;
    expect(p.modelGroup).toBeNull();
    expect(p.createdAt).toBe("");
    expect(p.pieces).toBeNull();
    expect(p.presentations.map((pr) => pr.sku)).toEqual(["OLD-1", "OLD-1-CAJA"]);
    expect(p.presentations[0]).toMatchObject({
      isBase: true,
      name: "unidad",
      factor: 1,
      price: 300,
      compareAtPrice: 350,
    });
    expect(p.presentations[1]).toMatchObject({ price: 2000, compareAtPrice: null });
    expect(groupCatalog(products)[0].key).toBe("p:OLD-1");
  });

  it("la base con SKU propio pero sin price hereda el precio efectivo del producto", () => {
    const { products } = sanitizeCatalog({
      currency: { code: "CUP", symbol: "$", decimalPlaces: 0 },
      products: [
        {
          sku: "OLD-2",
          name: "Camiseta vieja",
          description: null,
          category: null,
          price: 900,
          compareAtPrice: 1000,
          featured: false,
          stockAvailable: 5,
          imageUrl: null,
          offer: null,
          isCatchWeight: false,
          pricePerKg: null,
          presentations: [
            {
              sku: "OLD-2-U",
              name: "Unidad",
              factor: 1,
              retailPrice: 25,
              wholesalePrice: null,
              barcode: null,
              isBase: true,
              piecesPerUnit: null,
              nominalWeightKg: null,
              estimatedPrice: null,
              stockPieces: null,
            },
          ],
        },
      ],
    });
    const [p] = products;
    expect(p.presentations).toHaveLength(1);
    const [base] = sortedPresentations(p);
    expect(base).toMatchObject({ sku: "OLD-2-U", isBase: true, price: 900, compareAtPrice: 1000 });
    expect(formatPrice(p, base)).toBe(900);
    expect(formatCompareAtPrice(p, base)).toBe(1000);
    expect(formatDiscountPct(p, base)).toBe(10);
  });
});
