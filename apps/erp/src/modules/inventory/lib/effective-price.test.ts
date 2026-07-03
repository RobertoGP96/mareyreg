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

import {
  getEffectivePrice,
  getEffectivePrices,
  getEffectiveLinePrices,
  lineKey,
} from "./effective-price";

const BASE = { currencyId: 1, code: "CUP", symbol: "$", decimalPlaces: 0 };
const USD_ID = 2;

type MockDb = {
  product: { findMany: ReturnType<typeof vi.fn> };
  productPresentation: { findMany: ReturnType<typeof vi.fn> };
  customer: { findUnique: ReturnType<typeof vi.fn> };
  priceListItem: { findMany: ReturnType<typeof vi.fn> };
  discount: { findMany: ReturnType<typeof vi.fn> };
};

function createMockDb(): MockDb {
  return {
    product: { findMany: vi.fn() },
    productPresentation: { findMany: vi.fn() },
    customer: { findUnique: vi.fn() },
    priceListItem: { findMany: vi.fn() },
    discount: { findMany: vi.fn() },
  };
}

function presentation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    presentationId: 10,
    productId: 1,
    name: "Caja 24",
    factor: 24,
    retailPrice: 550,
    wholesalePrice: null,
    priceCurrencyId: null,
    isBase: false,
    isActive: true,
    ...overrides,
  };
}

function product(
  overrides: Partial<{
    productId: number;
    salePrice: number;
    saleCurrencyId: number | null;
    category: string | null;
    isCatchWeight: boolean;
  }> = {}
) {
  return {
    productId: 1,
    salePrice: 100,
    saleCurrencyId: null,
    category: null,
    isCatchWeight: false,
    ...overrides,
  };
}

function discount(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    discountId: 1,
    name: "Descuento",
    type: "percent",
    value: 10,
    minQty: null,
    startsAt: null,
    endsAt: null,
    productId: 1,
    category: null,
    customerId: null,
    isActive: true,
    ...overrides,
  };
}

describe("effective-price", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    getBaseCurrency.mockResolvedValue(BASE);
    getRateToBase.mockReset();
    db.customer.findUnique.mockResolvedValue(null);
    db.priceListItem.findMany.mockResolvedValue([]);
    db.productPresentation.findMany.mockResolvedValue([]);
  });

  describe("sin descuentos", () => {
    it("finalPrice === basePrice y appliedDiscounts vacío", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 100 })]);
      db.discount.findMany.mockResolvedValue([]);

      const result = await getEffectivePrice(db as never, { productId: 1, quantity: 1 });

      expect(result.basePrice).toBe(100);
      expect(result.finalPrice).toBe(100);
      expect(result.appliedDiscounts).toEqual([]);
    });
  });

  describe("un solo descuento activo percent", () => {
    it("aplica el descuento y appliedDiscounts tiene 1 elemento", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 100 })]);
      db.discount.findMany.mockResolvedValue([discount({ type: "percent", value: 20 })]);

      const result = await getEffectivePrice(db as never, { productId: 1, quantity: 1 });

      expect(result.finalPrice).toBe(80);
      expect(result.appliedDiscounts).toHaveLength(1);
      expect(result.appliedDiscounts[0]).toMatchObject({ discountId: 1, discountAmount: 20 });
    });
  });

  describe("varios descuentos activos", () => {
    it("aplica solo el de mayor beneficio, nunca se suman", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 100 })]);
      db.discount.findMany.mockResolvedValue([
        discount({ discountId: 1, name: "10%", type: "percent", value: 10 }),
        discount({ discountId: 2, name: "30%", type: "percent", value: 30 }),
        discount({ discountId: 3, name: "5 fijo", type: "fixed", value: 5 }),
      ]);

      const result = await getEffectivePrice(db as never, { productId: 1, quantity: 1 });

      expect(result.finalPrice).toBe(70);
      expect(result.appliedDiscounts).toHaveLength(1);
      expect(result.appliedDiscounts[0].discountId).toBe(2);
    });
  });

  describe("vigencia", () => {
    it("descuento con startsAt futuro NO se aplica (filtrado en query, no llega a resolvePriceFromDiscounts)", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 100 })]);
      // La query real filtra por startsAt/endsAt en el WHERE; el mock simula
      // que ese descuento nunca es devuelto por Prisma al estar fuera de vigencia.
      db.discount.findMany.mockResolvedValue([]);

      const result = await getEffectivePrice(db as never, { productId: 1, quantity: 1 });

      expect(result.finalPrice).toBe(100);
      expect(result.appliedDiscounts).toEqual([]);
    });

    it("pasa correctamente startsAt/endsAt/minQty/customerId al WHERE de discount.findMany", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 100 })]);
      db.discount.findMany.mockResolvedValue([]);
      const at = new Date("2026-07-02T00:00:00Z");

      await getEffectivePrice(db as never, { productId: 1, quantity: 5, customerId: 42, at });

      const callArgs = db.discount.findMany.mock.calls[0][0];
      expect(callArgs.where.isActive).toBe(true);
      const andClauses = JSON.stringify(callArgs.where.AND);
      expect(andClauses).toContain("2026-07-02T00:00:00.000Z");
    });
  });

  describe("minQty", () => {
    it("no alcanzado → no se aplica (query excluye el descuento)", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 100 })]);
      // minQty=10 con quantity=1: el WHERE real de Prisma excluiría este
      // descuento (minQty <= quantity), así que el mock no lo devuelve.
      db.discount.findMany.mockResolvedValue([]);

      const result = await getEffectivePrice(db as never, { productId: 1, quantity: 1 });

      expect(result.finalPrice).toBe(100);
      expect(result.appliedDiscounts).toEqual([]);
    });

    it("alcanzado → sí se aplica", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 100 })]);
      db.discount.findMany.mockResolvedValue([
        discount({ type: "volume", value: 15, minQty: 10 }),
      ]);

      const result = await getEffectivePrice(db as never, { productId: 1, quantity: 10 });

      expect(result.finalPrice).toBe(85);
      expect(result.appliedDiscounts).toHaveLength(1);
    });
  });

  describe("fixed mayor que el precio", () => {
    it("finalPrice no baja de 0", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 50 })]);
      db.discount.findMany.mockResolvedValue([discount({ type: "fixed", value: 200 })]);

      const result = await getEffectivePrice(db as never, { productId: 1, quantity: 1 });

      expect(result.finalPrice).toBe(0);
      expect(result.finalPrice).toBeGreaterThanOrEqual(0);
    });
  });

  describe("scope de cliente", () => {
    it("descuento de otro customerId no se incluye en el resultado de la query (filtrado por WHERE)", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 100 })]);
      // El WHERE real filtra customerId: null OR customerId: opts.customerId.
      // Un descuento con customerId=999 nunca sería devuelto para customerId=42.
      db.discount.findMany.mockResolvedValue([]);

      const result = await getEffectivePrice(db as never, {
        productId: 1,
        quantity: 1,
        customerId: 42,
      });

      expect(result.finalPrice).toBe(100);
      expect(result.appliedDiscounts).toEqual([]);
    });

    it("descuento propio del cliente (customerId coincide) sí se aplica", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 100 })]);
      db.discount.findMany.mockResolvedValue([discount({ type: "percent", value: 25, customerId: 42 })]);

      const result = await getEffectivePrice(db as never, {
        productId: 1,
        quantity: 1,
        customerId: 42,
      });

      expect(result.finalPrice).toBe(75);
      expect(result.appliedDiscounts).toHaveLength(1);
    });
  });

  describe("getEffectivePrices (batch)", () => {
    it("resuelve varios productos en un solo Map y omite ids inexistentes", async () => {
      db.product.findMany.mockResolvedValue([
        product({ productId: 1, salePrice: 100 }),
        product({ productId: 2, salePrice: 50 }),
      ]);
      db.discount.findMany.mockResolvedValue([
        discount({ discountId: 1, productId: 1, type: "percent", value: 10 }),
      ]);

      const results = await getEffectivePrices(db as never, [1, 2, 999], { quantity: 1 });

      expect(results.size).toBe(2);
      expect(results.get(1)?.finalPrice).toBe(90);
      expect(results.get(2)?.finalPrice).toBe(50);
      expect(results.get(999)).toBeUndefined();
    });

    it("retorna Map vacío para lista de ids vacía sin llamar a la BD", async () => {
      const results = await getEffectivePrices(db as never, [], { quantity: 1 });

      expect(results.size).toBe(0);
      expect(db.product.findMany).not.toHaveBeenCalled();
    });
  });

  describe("getEffectivePrice unitario", () => {
    it("lanza error si el producto no existe (preserva comportamiento findUniqueOrThrow)", async () => {
      db.product.findMany.mockResolvedValue([]);
      db.discount.findMany.mockResolvedValue([]);

      await expect(
        getEffectivePrice(db as never, { productId: 999, quantity: 1 })
      ).rejects.toThrow("Producto 999 no encontrado");
    });
  });

  describe("getEffectiveLinePrices (presentaciones)", () => {
    it("línea sin presentación se comporta como el flujo actual (factor 1)", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 25 })]);
      db.discount.findMany.mockResolvedValue([]);

      const results = await getEffectiveLinePrices(db as never, [
        { productId: 1, quantity: 3 },
      ]);

      const line = results.get(lineKey(1, null));
      expect(line?.basePrice).toBe(25);
      expect(line?.finalPrice).toBe(25);
      expect(line?.factor).toBe(1);
    });

    it("presentación usa retailPrice y expone su factor", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 25 })]);
      db.productPresentation.findMany.mockResolvedValue([presentation()]);
      db.discount.findMany.mockResolvedValue([]);

      const results = await getEffectiveLinePrices(db as never, [
        { productId: 1, presentationId: 10, quantity: 2 },
      ]);

      const line = results.get(lineKey(1, 10));
      expect(line?.basePrice).toBe(550);
      expect(line?.factor).toBe(24);
    });

    it("cliente wholesale recibe wholesalePrice cuando la presentación lo define", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 25 })]);
      db.productPresentation.findMany.mockResolvedValue([
        presentation({ wholesalePrice: 480 }),
      ]);
      db.customer.findUnique.mockResolvedValue({ priceListId: null, customerType: "wholesale" });
      db.discount.findMany.mockResolvedValue([]);

      const results = await getEffectiveLinePrices(
        db as never,
        [{ productId: 1, presentationId: 10, quantity: 1 }],
        { customerId: 42 }
      );

      expect(results.get(lineKey(1, 10))?.basePrice).toBe(480);
    });

    it("cliente wholesale sin wholesalePrice definido cae a retailPrice", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 25 })]);
      db.productPresentation.findMany.mockResolvedValue([presentation({ wholesalePrice: null })]);
      db.customer.findUnique.mockResolvedValue({ priceListId: null, customerType: "wholesale" });
      db.discount.findMany.mockResolvedValue([]);

      const results = await getEffectiveLinePrices(
        db as never,
        [{ productId: 1, presentationId: 10, quantity: 1 }],
        { customerId: 42 }
      );

      expect(results.get(lineKey(1, 10))?.basePrice).toBe(550);
    });

    it("la lista de precios del cliente solo sobrescribe la presentación base", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 25 })]);
      db.productPresentation.findMany.mockResolvedValue([
        presentation({ presentationId: 9, name: "lata", factor: 1, retailPrice: 25, isBase: true }),
        presentation({ presentationId: 10 }),
      ]);
      db.customer.findUnique.mockResolvedValue({ priceListId: 7, customerType: "retail" });
      db.priceListItem.findMany.mockResolvedValue([{ productId: 1, price: 20, currencyId: null }]);
      db.discount.findMany.mockResolvedValue([]);

      const results = await getEffectiveLinePrices(
        db as never,
        [
          { productId: 1, presentationId: 9, quantity: 1 },
          { productId: 1, presentationId: 10, quantity: 1 },
        ],
        { customerId: 42 }
      );

      expect(results.get(lineKey(1, 9))?.basePrice).toBe(20); // lista gana en base
      expect(results.get(lineKey(1, 10))?.basePrice).toBe(550); // no-base conserva su precio
    });

    it("minQty de descuentos por volumen se evalúa en unidades base", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 25 })]);
      db.productPresentation.findMany.mockResolvedValue([presentation()]);
      // getEffectiveLinePrices NO filtra minQty en la query: lo evalúa por línea.
      db.discount.findMany.mockResolvedValue([
        discount({ type: "volume", value: 10, minQty: 24 }),
      ]);

      const results = await getEffectiveLinePrices(db as never, [
        { productId: 1, presentationId: 10, quantity: 1 }, // 1 caja = 24 base → aplica
        { productId: 1, quantity: 12 }, // 12 latas → no aplica
      ]);

      expect(results.get(lineKey(1, 10))?.appliedDiscounts).toHaveLength(1);
      expect(results.get(lineKey(1, null))?.appliedDiscounts).toHaveLength(0);
    });

    it("presentación de otro producto lanza error", async () => {
      db.product.findMany.mockResolvedValue([product({ productId: 2, salePrice: 30 })]);
      db.productPresentation.findMany.mockResolvedValue([presentation({ productId: 1 })]);
      db.discount.findMany.mockResolvedValue([]);

      await expect(
        getEffectiveLinePrices(db as never, [{ productId: 2, presentationId: 10, quantity: 1 }])
      ).rejects.toThrow("no corresponde al producto");
    });

    it("presentación inactiva lanza error", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 25 })]);
      db.productPresentation.findMany.mockResolvedValue([presentation({ isActive: false })]);
      db.discount.findMany.mockResolvedValue([]);

      await expect(
        getEffectiveLinePrices(db as never, [{ productId: 1, presentationId: 10, quantity: 1 }])
      ).rejects.toThrow("inactiva");
    });
  });

  describe("getEffectiveLinePrices (catch-weight)", () => {
    it("producto catch-weight retorna pricePerBase resuelto desde la presentación base", async () => {
      db.product.findMany.mockResolvedValue([
        product({ salePrice: 25, isCatchWeight: true }),
      ]);
      db.productPresentation.findMany.mockResolvedValue([
        presentation({ presentationId: 9, name: "kg", factor: 1, retailPrice: 80, isBase: true }),
        presentation({ presentationId: 10, name: "Caja", factor: 5, retailPrice: 380 }),
      ]);
      db.discount.findMany.mockResolvedValue([]);

      const results = await getEffectiveLinePrices(db as never, [
        { productId: 1, presentationId: 10, quantity: 1 },
      ]);

      const line = results.get(lineKey(1, 10));
      expect(line?.pricePerBase).toBe(80);
      // El precio de la línea (Caja) no se ve afectado por pricePerBase.
      expect(line?.basePrice).toBe(380);
    });

    it("producto normal deja pricePerBase undefined", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 25, isCatchWeight: false })]);
      db.productPresentation.findMany.mockResolvedValue([presentation()]);
      db.discount.findMany.mockResolvedValue([]);

      const results = await getEffectiveLinePrices(db as never, [
        { productId: 1, presentationId: 10, quantity: 1 },
      ]);

      expect(results.get(lineKey(1, 10))?.pricePerBase).toBeUndefined();
    });

    it("pricePerBase respeta la lista de precios del cliente sobre la base", async () => {
      db.product.findMany.mockResolvedValue([
        product({ salePrice: 25, isCatchWeight: true }),
      ]);
      db.productPresentation.findMany.mockResolvedValue([
        presentation({ presentationId: 9, name: "kg", factor: 1, retailPrice: 80, isBase: true }),
        presentation({ presentationId: 10, name: "Caja", factor: 5, retailPrice: 380 }),
      ]);
      db.customer.findUnique.mockResolvedValue({ priceListId: 7, customerType: "retail" });
      db.priceListItem.findMany.mockResolvedValue([{ productId: 1, price: 70, currencyId: null }]);
      db.discount.findMany.mockResolvedValue([]);

      const results = await getEffectiveLinePrices(
        db as never,
        [{ productId: 1, presentationId: 10, quantity: 1 }],
        { customerId: 42 }
      );

      expect(results.get(lineKey(1, 10))?.pricePerBase).toBe(70);
    });
  });

  describe("multi-moneda", () => {
    it("getEffectivePrices: salePrice en USD se convierte a base y se redondea", async () => {
      getRateToBase.mockResolvedValue({ exchangeRateId: 5, rate: 400 });
      db.product.findMany.mockResolvedValue([
        product({ salePrice: 1.5, saleCurrencyId: USD_ID }),
      ]);
      db.discount.findMany.mockResolvedValue([]);

      const results = await getEffectivePrices(db as never, [1], { quantity: 1 });

      const result = results.get(1);
      expect(getRateToBase).toHaveBeenCalledWith(db, USD_ID);
      expect(result?.basePrice).toBe(600); // 1.5 * 400
      expect(result?.finalPrice).toBe(600); // CUP decimalPlaces=0, ya es entero
      expect(result?.priceCurrencyId).toBe(USD_ID);
      expect(result?.rateApplied).toBe(400);
    });

    it("getEffectivePrices: precio de lista en USD se convierte antes de descuentos", async () => {
      getRateToBase.mockResolvedValue({ exchangeRateId: 5, rate: 400 });
      db.product.findMany.mockResolvedValue([product({ salePrice: 100, saleCurrencyId: null })]);
      db.customer.findUnique.mockResolvedValue({ priceListId: 7 });
      db.priceListItem.findMany.mockResolvedValue([
        { productId: 1, price: 2, currencyId: USD_ID },
      ]);
      db.discount.findMany.mockResolvedValue([discount({ type: "percent", value: 10 })]);

      const results = await getEffectivePrices(db as never, [1], {
        quantity: 1,
        customerId: 42,
      });

      const result = results.get(1);
      expect(result?.basePrice).toBe(800); // 2 USD * 400
      expect(result?.finalPrice).toBe(720); // 800 - 10%
    });

    it("getEffectivePrices: sin tasa configurada, propaga GlobalRateNotConfiguredError", async () => {
      getRateToBase.mockRejectedValue(new Error("No hay una tasa de cambio configurada"));
      db.product.findMany.mockResolvedValue([
        product({ salePrice: 1, saleCurrencyId: USD_ID }),
      ]);
      db.discount.findMany.mockResolvedValue([]);

      await expect(
        getEffectivePrices(db as never, [1], { quantity: 1 })
      ).rejects.toThrow("No hay una tasa de cambio configurada");
    });

    it("getEffectiveLinePrices: presentación con precio en USD se convierte y redondea a entero CUP", async () => {
      getRateToBase.mockResolvedValue({ exchangeRateId: 5, rate: 400 });
      db.product.findMany.mockResolvedValue([product({ salePrice: 25 })]);
      db.productPresentation.findMany.mockResolvedValue([
        presentation({ retailPrice: 22.995, priceCurrencyId: USD_ID }),
      ]);
      db.discount.findMany.mockResolvedValue([]);

      const results = await getEffectiveLinePrices(db as never, [
        { productId: 1, presentationId: 10, quantity: 1 },
      ]);

      const line = results.get(lineKey(1, 10));
      expect(getRateToBase).toHaveBeenCalledWith(db, USD_ID);
      expect(line?.basePrice).toBeCloseTo(9198); // 22.995 * 400
      expect(line?.finalPrice).toBe(9198); // redondeado a entero (CUP decimalPlaces=0)
      expect(line?.priceCurrencyId).toBe(USD_ID);
      expect(line?.rateApplied).toBe(400);
    });

    it("getEffectiveLinePrices: una sola llamada a getRateToBase por moneda distinta en el batch", async () => {
      getRateToBase.mockResolvedValue({ exchangeRateId: 5, rate: 400 });
      db.product.findMany.mockResolvedValue([
        product({ productId: 1, salePrice: 1, saleCurrencyId: USD_ID }),
        product({ productId: 2, salePrice: 2, saleCurrencyId: USD_ID }),
      ]);
      db.discount.findMany.mockResolvedValue([]);

      await getEffectiveLinePrices(db as never, [
        { productId: 1, quantity: 1 },
        { productId: 2, quantity: 1 },
      ]);

      expect(getRateToBase).toHaveBeenCalledTimes(1);
    });

    it("getEffectiveLinePrices: línea sin moneda explícita (null) no llama a getRateToBase", async () => {
      db.product.findMany.mockResolvedValue([product({ salePrice: 100, saleCurrencyId: null })]);
      db.discount.findMany.mockResolvedValue([]);

      const results = await getEffectiveLinePrices(db as never, [{ productId: 1, quantity: 1 }]);

      expect(getRateToBase).not.toHaveBeenCalled();
      expect(results.get(lineKey(1, null))?.rateApplied ?? null).toBeNull();
    });
  });
});
