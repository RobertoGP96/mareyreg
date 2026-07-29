import { describe, it, expect, vi, beforeEach } from "vitest";

const { getBaseCurrency, getRateToBase } = vi.hoisted(() => ({
  getBaseCurrency: vi.fn(),
  getRateToBase: vi.fn(),
}));

const { getEffectiveLinePrices } = vi.hoisted(() => ({
  getEffectiveLinePrices: vi.fn(),
}));

const { db } = vi.hoisted(() => ({
  db: {
    product: { findMany: vi.fn() },
    productValuation: { findMany: vi.fn() },
    productCost: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db }));

vi.mock("@/lib/currency", async () => {
  const actual = await vi.importActual<typeof import("@/lib/currency")>("@/lib/currency");
  return {
    ...actual,
    getBaseCurrency,
    getRateToBase,
  };
});

vi.mock("../lib/effective-price", async () => {
  const actual = await vi.importActual<typeof import("../lib/effective-price")>(
    "../lib/effective-price"
  );
  return {
    ...actual,
    getEffectiveLinePrices,
  };
});

import { getMarginReport } from "./margin-report-queries";
import { lineKey } from "../lib/effective-price";

const BASE = { currencyId: 1, code: "CUP", symbol: "$", decimalPlaces: 0 };
const USD_ID = 2;

function product(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    productId: 1,
    name: "Producto A",
    sku: "SKU-1",
    category: "General",
    salePrice: 100,
    ...overrides,
  };
}

function priceResultMap(entries: Array<[number, number]>) {
  const map = new Map<string, { finalPrice: number }>();
  for (const [productId, finalPrice] of entries) {
    map.set(lineKey(productId, null), { finalPrice });
  }
  return map;
}

describe("getMarginReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBaseCurrency.mockResolvedValue(BASE);
    getRateToBase.mockReset();
    db.product.findMany.mockResolvedValue([]);
    db.productValuation.findMany.mockResolvedValue([]);
    db.productCost.findMany.mockResolvedValue([]);
    getEffectiveLinePrices.mockResolvedValue(new Map());
  });

  it("producto con precio USD y ProductCost: calcula márgenes correctos", async () => {
    db.product.findMany.mockResolvedValue([product({ productId: 1, salePrice: 100 })]);
    getEffectiveLinePrices.mockResolvedValue(priceResultMap([[1, 100]]));
    db.productValuation.findMany.mockResolvedValue([{ productId: 1, totalCost: 800, totalQty: 10 }]);
    db.productCost.findMany.mockResolvedValue([
      {
        productId: 1,
        currencyId: USD_ID,
        lastUnitCost: 0.2,
        currency: { code: "USD" },
      },
    ]);
    getRateToBase.mockResolvedValue({ exchangeRateId: 5, rate: 400 }); // 400 CUP por USD

    const result = await getMarginReport();

    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.priceBase).toBe(100);
    expect(row.accountingCostBase).toBe(80); // 800/10
    expect(row.replacementCostBase).toBe(80); // 0.2 * 400
    expect(row.purchaseCurrencyCode).toBe("USD");
    expect(row.marginPct).toBeCloseTo(((100 - 80) / 80) * 100);
    expect(row.replacementMarginPct).toBeCloseTo(((100 - 80) / 80) * 100);
    expect(row.warning).toBeNull();
  });

  it("onlyWarnings filtra productos sin warning", async () => {
    db.product.findMany.mockResolvedValue([
      product({ productId: 1, name: "Sano" }),
      product({ productId: 2, name: "Negativo" }),
    ]);
    getEffectiveLinePrices.mockResolvedValue(priceResultMap([[1, 100], [2, 100]]));
    db.productCost.findMany.mockResolvedValue([
      { productId: 1, currencyId: BASE.currencyId, lastUnitCost: 50, currency: { code: "CUP" } },
      { productId: 2, currencyId: BASE.currencyId, lastUnitCost: 150, currency: { code: "CUP" } },
    ]);

    const full = await getMarginReport();
    expect(full.rows).toHaveLength(2);

    const onlyWarnings = await getMarginReport({ onlyWarnings: true });
    expect(onlyWarnings.rows).toHaveLength(1);
    expect(onlyWarnings.rows[0].productId).toBe(2);
    expect(onlyWarnings.rows[0].warning).toBe("negative");
  });

  it("producto sin ProductCost: replacementCostBase y warning son null", async () => {
    db.product.findMany.mockResolvedValue([product({ productId: 1 })]);
    getEffectiveLinePrices.mockResolvedValue(priceResultMap([[1, 100]]));
    db.productCost.findMany.mockResolvedValue([]);

    const result = await getMarginReport();

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].replacementCostBase).toBeNull();
    expect(result.rows[0].replacementMarginPct).toBeNull();
    expect(result.rows[0].warning).toBeNull();
  });

  it("productos sin salePrice se excluyen del reporte", async () => {
    db.product.findMany.mockResolvedValue([
      product({ productId: 1, salePrice: 100 }),
      product({ productId: 2, salePrice: null }),
    ]);
    getEffectiveLinePrices.mockResolvedValue(priceResultMap([[1, 100]]));

    const result = await getMarginReport();

    expect(result.rows).toHaveLength(1);
    expect(result.summary.totalProducts).toBe(1);
  });
});
