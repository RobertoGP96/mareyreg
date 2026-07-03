import { describe, it, expect, vi, beforeEach } from "vitest";

const { getBaseCurrency, getRateToBase } = vi.hoisted(() => ({
  getBaseCurrency: vi.fn(),
  getRateToBase: vi.fn(),
}));

vi.mock("@/lib/currency", async () => {
  const actual = await vi.importActual<typeof import("@/lib/currency")>("@/lib/currency");
  return {
    ...actual,
    getBaseCurrency,
    getRateToBase,
  };
});

import { computeMarginInfo, LOW_MARGIN_THRESHOLD_PCT } from "./margin";

const BASE = { currencyId: 1, code: "CUP", symbol: "$", decimalPlaces: 0 };
const USD_ID = 2;

type MockDb = {
  productPresentation: { findUnique: ReturnType<typeof vi.fn> };
  productCost: { findUnique: ReturnType<typeof vi.fn> };
  productValuation: { findMany: ReturnType<typeof vi.fn> };
};

function createMockDb(): MockDb {
  return {
    productPresentation: { findUnique: vi.fn() },
    productCost: { findUnique: vi.fn() },
    productValuation: { findMany: vi.fn() },
  };
}

describe("computeMarginInfo", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    getBaseCurrency.mockResolvedValue(BASE);
    getRateToBase.mockReset();
    db.productValuation.findMany.mockResolvedValue([]);
    db.productCost.findUnique.mockResolvedValue(null);
    db.productPresentation.findUnique.mockResolvedValue(null);
  });

  it("sin ProductCost: replacementCostBase y replacementMarginPct son null, sin warning", async () => {
    const result = await computeMarginInfo(db as never, {
      productId: 1,
      priceAmount: 100,
    });

    expect(result.priceBase).toBe(100);
    expect(result.replacementCostBase).toBeNull();
    expect(result.replacementMarginPct).toBeNull();
    expect(result.warning).toBeNull();
  });

  it("con ProductCost en moneda base: calcula margen de reposición", async () => {
    db.productCost.findUnique.mockResolvedValue({ currencyId: 1, lastUnitCost: 80 });

    const result = await computeMarginInfo(db as never, {
      productId: 1,
      priceAmount: 100,
    });

    expect(result.replacementCostBase).toBe(80);
    expect(result.replacementMarginPct).toBeCloseTo(25); // (100-80)/80
    expect(result.warning).toBeNull();
  });

  it("precio en USD: convierte a base con la tasa vigente antes de comparar", async () => {
    getRateToBase.mockResolvedValue({ exchangeRateId: 5, rate: 400 }); // 400 CUP por USD
    db.productCost.findUnique.mockResolvedValue({ currencyId: 1, lastUnitCost: 300 });

    const result = await computeMarginInfo(db as never, {
      productId: 1,
      priceAmount: 1, // 1 USD
      priceCurrencyId: USD_ID,
    });

    expect(getRateToBase).toHaveBeenCalledWith(db, USD_ID);
    expect(result.priceBase).toBe(400);
    expect(result.replacementCostBase).toBe(300);
    expect(result.replacementMarginPct).toBeCloseTo((400 - 300) / 300 * 100);
  });

  it("costo de reposición en moneda distinta a la del precio: convierte el costo con su propia tasa", async () => {
    // Precio en base (CUP), costo de reposición en USD.
    getRateToBase.mockResolvedValue({ exchangeRateId: 5, rate: 400 });
    db.productCost.findUnique.mockResolvedValue({ currencyId: USD_ID, lastUnitCost: 1 });

    const result = await computeMarginInfo(db as never, {
      productId: 1,
      priceAmount: 500,
    });

    expect(getRateToBase).toHaveBeenCalledWith(db, USD_ID);
    expect(result.replacementCostBase).toBe(400);
    expect(result.replacementMarginPct).toBeCloseTo((500 - 400) / 400 * 100);
  });

  it("precio por presentación: divide por el factor antes de comparar costo por unidad base", async () => {
    db.productPresentation.findUnique.mockResolvedValue({ factor: 24 });
    db.productCost.findUnique.mockResolvedValue({ currencyId: 1, lastUnitCost: 20 });

    const result = await computeMarginInfo(db as never, {
      productId: 1,
      presentationId: 10,
      priceAmount: 552, // caja de 24 a 552 => 23/unidad base
    });

    expect(result.priceBase).toBeCloseTo(23);
    expect(result.replacementCostBase).toBe(20);
    expect(result.replacementMarginPct).toBeCloseTo((23 - 20) / 20 * 100);
  });

  it("margen negativo dispara warning 'negative'", async () => {
    db.productCost.findUnique.mockResolvedValue({ currencyId: 1, lastUnitCost: 120 });

    const result = await computeMarginInfo(db as never, {
      productId: 1,
      priceAmount: 100,
    });

    expect(result.replacementMarginPct).toBeLessThan(0);
    expect(result.warning).toBe("negative");
  });

  it("margen bajo (< umbral) dispara warning 'low'", async () => {
    db.productCost.findUnique.mockResolvedValue({ currencyId: 1, lastUnitCost: 95 });

    const result = await computeMarginInfo(db as never, {
      productId: 1,
      priceAmount: 100,
    });

    expect(result.replacementMarginPct).toBeCloseTo(((100 - 95) / 95) * 100);
    expect(result.replacementMarginPct).toBeLessThan(LOW_MARGIN_THRESHOLD_PCT);
    expect(result.warning).toBe("low");
  });

  it("margen saludable (>= umbral) no dispara warning", async () => {
    db.productCost.findUnique.mockResolvedValue({ currencyId: 1, lastUnitCost: 50 });

    const result = await computeMarginInfo(db as never, {
      productId: 1,
      priceAmount: 100,
    });

    expect(result.replacementMarginPct).toBeGreaterThanOrEqual(LOW_MARGIN_THRESHOLD_PCT);
    expect(result.warning).toBeNull();
  });

  it("costo contable (ProductValuation) promedia entre almacenes", async () => {
    db.productValuation.findMany.mockResolvedValue([
      { totalCost: 800, totalQty: 10 },
      { totalCost: 400, totalQty: 10 },
    ]);

    const result = await computeMarginInfo(db as never, {
      productId: 1,
      priceAmount: 100,
    });

    // (800+400)/(10+10) = 60
    expect(result.accountingCostBase).toBe(60);
    expect(result.marginPct).toBeCloseTo(((100 - 60) / 60) * 100);
  });

  it("sin stock (totalQty=0 en todos los almacenes): accountingCostBase null", async () => {
    db.productValuation.findMany.mockResolvedValue([{ totalCost: 0, totalQty: 0 }]);

    const result = await computeMarginInfo(db as never, {
      productId: 1,
      priceAmount: 100,
    });

    expect(result.accountingCostBase).toBeNull();
    expect(result.marginPct).toBeNull();
  });

  it("propaga el error si falta la tasa de la moneda del PRECIO", async () => {
    getRateToBase.mockRejectedValue(new Error("No hay una tasa de cambio configurada"));

    await expect(
      computeMarginInfo(db as never, { productId: 1, priceAmount: 1, priceCurrencyId: USD_ID })
    ).rejects.toThrow("No hay una tasa de cambio configurada");
  });
});
