import { describe, it, expect, vi, beforeEach } from "vitest";

const { writeDiscountHistory, tx } = vi.hoisted(() => {
  const tx = {
    product: {
      findMany: vi.fn(),
    },
    discount: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  return {
    writeDiscountHistory: vi.fn().mockResolvedValue(undefined),
    tx,
  };
});

vi.mock("@/modules/inventory/lib/discount-history", () => ({
  writeDiscountHistory,
}));

import { syncOfferDiscounts, OfferConflictError, type OfferHeaderInput } from "./sync-offer-discounts";

function baseOffer(overrides: Partial<OfferHeaderInput> = {}): OfferHeaderInput {
  return {
    offerId: 1,
    name: "Oferta test",
    type: "percent",
    value: 10,
    startsAt: null,
    endsAt: null,
    isActive: true,
    ...overrides,
  };
}

function product(overrides: Partial<{ productId: number; name: string; isActive: boolean; webstoreEnabled: boolean }> = {}) {
  return {
    productId: 1,
    name: "Producto 1",
    isActive: true,
    webstoreEnabled: true,
    ...overrides,
  };
}

describe("syncOfferDiscounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.discount.findMany.mockResolvedValue([]);
    tx.discount.updateMany.mockResolvedValue({ count: 0 });
  });

  it("lanza error si algún producto no existe", async () => {
    tx.product.findMany.mockResolvedValue([product({ productId: 1 })]);

    await expect(
      syncOfferDiscounts(tx as never, baseOffer(), [1, 2], 5)
    ).rejects.toThrow("Producto(s) no encontrado(s): 2");
  });

  it("lanza error si un producto no está activo o no está habilitado en la tienda", async () => {
    tx.product.findMany.mockResolvedValue([
      product({ productId: 1, isActive: false }),
    ]);

    await expect(
      syncOfferDiscounts(tx as never, baseOffer(), [1], 5)
    ).rejects.toThrow(/no están activos o no están habilitados/);
  });

  describe("conflicto con otra oferta activa", () => {
    it("lanza OfferConflictError listando producto y oferta en conflicto", async () => {
      tx.product.findMany.mockResolvedValue([product({ productId: 1 })]);
      tx.discount.findMany.mockResolvedValueOnce([
        {
          discountId: 99,
          productId: 1,
          offer: { offerId: 2, name: "Oferta rival" },
        },
      ]); // conflicting query

      await expect(
        syncOfferDiscounts(tx as never, baseOffer({ offerId: 1 }), [1], 5)
      ).rejects.toThrow(OfferConflictError);
    });

    it("el mensaje de conflicto incluye el nombre del producto y de la oferta rival", async () => {
      tx.product.findMany.mockResolvedValue([product({ productId: 1 })]);
      tx.discount.findMany.mockResolvedValueOnce([
        {
          discountId: 99,
          productId: 1,
          offer: { offerId: 2, name: "Oferta rival" },
        },
      ]);

      await expect(
        syncOfferDiscounts(tx as never, baseOffer({ offerId: 1 }), [1], 5)
      ).rejects.toThrow(/Producto 1 \(oferta "Oferta rival"\)/);
    });

    it("no cuenta como conflicto un discount que pertenece a la MISMA oferta", async () => {
      tx.product.findMany.mockResolvedValue([product({ productId: 1 })]);
      // La query real filtra notIn: [offer.offerId], así que el mock simplemente no debe
      // devolver conflictos para este escenario.
      tx.discount.findMany
        .mockResolvedValueOnce([]) // conflicting
        .mockResolvedValueOnce([]) // manualActive
        .mockResolvedValueOnce([{ discountId: 10, productId: 1, offerId: 1 }]); // currentDiscounts

      await expect(
        syncOfferDiscounts(tx as never, baseOffer({ offerId: 1 }), [1], 5)
      ).resolves.not.toThrow();
    });
  });

  describe("conflicto con descuento manual activo", () => {
    it("desactiva el descuento manual y escribe historial 'deactivated'", async () => {
      tx.product.findMany.mockResolvedValue([product({ productId: 1 })]);
      tx.discount.findMany
        .mockResolvedValueOnce([]) // conflicting (otra oferta) - ninguno
        .mockResolvedValueOnce([{ discountId: 50, productId: 1, isActive: true, offerId: null }]) // manualActive
        .mockResolvedValueOnce([]); // currentDiscounts de la oferta (vacío -> crea)
      tx.discount.updateMany.mockResolvedValue({ count: 1 });
      tx.discount.create.mockResolvedValue({ discountId: 100, productId: 1 });

      await syncOfferDiscounts(tx as never, baseOffer({ offerId: 1 }), [1], 5);

      expect(tx.discount.updateMany).toHaveBeenCalledWith({
        where: { discountId: { in: [50] } },
        data: { isActive: false, version: { increment: 1 } },
      });
      expect(writeDiscountHistory).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ discountId: 50, action: "deactivated" })
      );
    });
  });

  describe("diff de productos", () => {
    it("crea un discount espejo para un producto nuevo de la oferta", async () => {
      tx.product.findMany.mockResolvedValue([product({ productId: 1 })]);
      tx.discount.findMany
        .mockResolvedValueOnce([]) // conflicting
        .mockResolvedValueOnce([]) // manualActive
        .mockResolvedValueOnce([]); // currentDiscounts (ninguno existente)
      tx.discount.create.mockResolvedValue({ discountId: 200, productId: 1 });

      await syncOfferDiscounts(tx as never, baseOffer({ offerId: 1 }), [1], 5);

      expect(tx.discount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ productId: 1, offerId: 1, name: "Oferta test" }),
      });
      expect(writeDiscountHistory).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ discountId: 200, productId: 1, action: "created" })
      );
    });

    it("actualiza el discount espejo existente cuando el producto sigue en la oferta", async () => {
      tx.product.findMany.mockResolvedValue([product({ productId: 1 })]);
      tx.discount.findMany
        .mockResolvedValueOnce([]) // conflicting
        .mockResolvedValueOnce([]) // manualActive
        .mockResolvedValueOnce([{ discountId: 300, productId: 1, offerId: 1 }]); // currentDiscounts
      tx.discount.update.mockResolvedValue({ discountId: 300 });

      await syncOfferDiscounts(tx as never, baseOffer({ offerId: 1, name: "Oferta editada" }), [1], 5);

      expect(tx.discount.update).toHaveBeenCalledWith({
        where: { discountId: 300 },
        data: expect.objectContaining({ name: "Oferta editada", version: { increment: 1 } }),
      });
      expect(writeDiscountHistory).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ discountId: 300, productId: 1, action: "updated" })
      );
    });

    it("elimina el discount espejo de un producto que ya no está en la oferta", async () => {
      tx.product.findMany.mockResolvedValue([product({ productId: 1 })]);
      tx.discount.findMany
        .mockResolvedValueOnce([]) // conflicting
        .mockResolvedValueOnce([]) // manualActive
        .mockResolvedValueOnce([
          { discountId: 400, productId: 2, offerId: 1 },
        ]); // currentDiscounts: producto 2 ya no está en la nueva lista [1]
      tx.discount.create.mockResolvedValue({ discountId: 500, productId: 1 });

      await syncOfferDiscounts(tx as never, baseOffer({ offerId: 1 }), [1], 5);

      expect(tx.discount.delete).toHaveBeenCalledWith({ where: { discountId: 400 } });
      expect(writeDiscountHistory).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ discountId: null, productId: 2, action: "deleted" })
      );
      // Y crea el nuevo producto 1
      expect(tx.discount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ productId: 1, offerId: 1 }),
      });
    });
  });

  describe("oferta inactiva", () => {
    it("no valida conflictos ni descuentos manuales cuando isActive=false", async () => {
      tx.product.findMany.mockResolvedValue([product({ productId: 1 })]);
      tx.discount.findMany.mockResolvedValueOnce([]); // solo la query de currentDiscounts
      tx.discount.create.mockResolvedValue({ discountId: 600, productId: 1 });

      await syncOfferDiscounts(tx as never, baseOffer({ offerId: 1, isActive: false }), [1], 5);

      // Solo 1 llamada a findMany (currentDiscounts) — no conflicting ni manualActive.
      expect(tx.discount.findMany).toHaveBeenCalledTimes(1);
      expect(tx.discount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isActive: false }),
      });
    });
  });
});
