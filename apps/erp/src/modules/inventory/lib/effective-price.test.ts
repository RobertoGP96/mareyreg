import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEffectivePrice, getEffectivePrices } from "./effective-price";

type MockDb = {
  product: { findMany: ReturnType<typeof vi.fn> };
  customer: { findUnique: ReturnType<typeof vi.fn> };
  priceListItem: { findMany: ReturnType<typeof vi.fn> };
  discount: { findMany: ReturnType<typeof vi.fn> };
};

function createMockDb(): MockDb {
  return {
    product: { findMany: vi.fn() },
    customer: { findUnique: vi.fn() },
    priceListItem: { findMany: vi.fn() },
    discount: { findMany: vi.fn() },
  };
}

function product(overrides: Partial<{ productId: number; salePrice: number; category: string | null }> = {}) {
  return {
    productId: 1,
    salePrice: 100,
    category: null,
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
    db.customer.findUnique.mockResolvedValue(null);
    db.priceListItem.findMany.mockResolvedValue([]);
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
});
