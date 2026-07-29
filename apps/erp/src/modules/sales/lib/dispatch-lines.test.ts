import { describe, it, expect, vi, beforeEach } from "vitest";

const { applyInventoryEntry, applyInventoryExit, getEffectiveLinePrices, lineKey } = vi.hoisted(() => {
  return {
    applyInventoryEntry: vi.fn(),
    applyInventoryExit: vi.fn(),
    getEffectiveLinePrices: vi.fn(),
    lineKey: (productId: number, presentationId?: number | null) =>
      `${productId}:${presentationId ?? "base"}`,
  };
});

vi.mock("@/lib/valuation", () => ({ applyInventoryEntry, applyInventoryExit }));
vi.mock("@/modules/inventory/lib/effective-price", () => ({ getEffectiveLinePrices, lineKey }));

import { dispatchLines, reverseInvoiceStock } from "./dispatch-lines";

type MockTx = {
  product: { findMany: ReturnType<typeof vi.fn> };
  productPresentation: { findMany: ReturnType<typeof vi.fn> };
  stockLevel: {
    updateMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  stockMovement: { create: ReturnType<typeof vi.fn> };
  lotStock: { update: ReturnType<typeof vi.fn> };
  invoiceLine: { create: ReturnType<typeof vi.fn> };
  productPiece: { findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
};

function createMockTx(): MockTx {
  return {
    product: { findMany: vi.fn() },
    productPresentation: { findMany: vi.fn() },
    stockLevel: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    stockMovement: { create: vi.fn() },
    lotStock: { update: vi.fn() },
    invoiceLine: { create: vi.fn() },
    productPiece: { findMany: vi.fn(), updateMany: vi.fn() },
  };
}

function product(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    productId: 1,
    name: "Pasta de tomate",
    unit: "lata",
    isService: false,
    allowNegative: false,
    valuationMethod: "average",
    ...overrides,
  };
}

function presentation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    presentationId: 10,
    productId: 1,
    name: "Caja 24",
    factor: 24,
    isActive: true,
    ...overrides,
  };
}

function effectivePriceResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    basePrice: 100,
    finalPrice: 100,
    appliedDiscounts: [],
    factor: 1,
    ...overrides,
  };
}

describe("dispatchLines", () => {
  let tx: MockTx;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = createMockTx();
    tx.stockMovement.create.mockResolvedValue({ movementId: 1 });
    tx.invoiceLine.create.mockResolvedValue({ lineId: 100 });
    tx.productPiece.findMany.mockResolvedValue([]);
    tx.productPiece.updateMany.mockResolvedValue({ count: 1 });
    applyInventoryExit.mockResolvedValue({ avgCostUsed: 5 });
  });

  describe("línea con presentación (factor 24)", () => {
    it("decrementa StockLevel en 48 (2 cajas de 24) y crea StockMovement de 48 con nota de equivalencia", async () => {
      tx.product.findMany.mockResolvedValue([product()]);
      tx.productPresentation.findMany.mockResolvedValue([presentation({ factor: 24 })]);
      tx.stockLevel.updateMany.mockResolvedValue({ count: 1 });
      getEffectiveLinePrices.mockResolvedValue(
        new Map([[lineKey(1, 10), effectivePriceResult({ finalPrice: 500, factor: 24 })]])
      );

      const result = await dispatchLines(tx as never, {
        invoiceId: 1,
        folio: "F-0001",
        warehouseId: 1,
        customerId: 1,
        lines: [{ productId: 1, presentationId: 10, quantity: 2, unitPrice: 500 }],
        allowManualPrice: true,
      });

      expect(tx.stockLevel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ productId: 1, warehouseId: 1, currentQuantity: { gte: 48 } }),
          data: expect.objectContaining({ currentQuantity: { decrement: 48 } }),
        })
      );

      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: 48,
            movementType: "exit",
            notes: expect.stringContaining("2 Caja 24 = 48 lata"),
          }),
        })
      );

      expect(result.lineResults[0]).toMatchObject({
        productId: 1,
        presentationId: 10,
        quantity: 2,
        unitFactor: 24,
        baseQuantity: 48,
      });
    });

    it("invoiceLine.create recibe presentationId/unitFactor/baseQuantity", async () => {
      tx.product.findMany.mockResolvedValue([product()]);
      tx.productPresentation.findMany.mockResolvedValue([presentation({ factor: 24 })]);
      tx.stockLevel.updateMany.mockResolvedValue({ count: 1 });
      getEffectiveLinePrices.mockResolvedValue(
        new Map([[lineKey(1, 10), effectivePriceResult({ finalPrice: 500, factor: 24 })]])
      );

      await dispatchLines(tx as never, {
        invoiceId: 1,
        folio: "F-0001",
        warehouseId: 1,
        customerId: 1,
        lines: [{ productId: 1, presentationId: 10, quantity: 2, unitPrice: 500 }],
        allowManualPrice: true,
      });

      expect(tx.invoiceLine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          presentationId: 10,
          unitFactor: 24,
          baseQuantity: 48,
        }),
      });
    });
  });

  describe("línea sin presentación", () => {
    it("se comporta como antes (factor 1, baseQuantity === quantity)", async () => {
      tx.product.findMany.mockResolvedValue([product()]);
      tx.productPresentation.findMany.mockResolvedValue([]);
      tx.stockLevel.updateMany.mockResolvedValue({ count: 1 });
      getEffectiveLinePrices.mockResolvedValue(
        new Map([[lineKey(1, undefined), effectivePriceResult({ finalPrice: 20, factor: 1 })]])
      );

      const result = await dispatchLines(tx as never, {
        invoiceId: 1,
        folio: "F-0001",
        warehouseId: 1,
        customerId: 1,
        lines: [{ productId: 1, quantity: 5, unitPrice: 20 }],
        allowManualPrice: true,
      });

      expect(tx.stockLevel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ currentQuantity: { gte: 5 } }),
          data: expect.objectContaining({ currentQuantity: { decrement: 5 } }),
        })
      );
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ quantity: 5 }) })
      );
      expect(result.lineResults[0]).toMatchObject({
        presentationId: null,
        unitFactor: 1,
        baseQuantity: 5,
      });
    });
  });

  describe("validación de presentación", () => {
    it("presentación de otro producto lanza error en español", async () => {
      tx.product.findMany.mockResolvedValue([product({ productId: 1 })]);
      tx.productPresentation.findMany.mockResolvedValue([
        presentation({ presentationId: 10, productId: 2 }),
      ]);
      getEffectiveLinePrices.mockResolvedValue(new Map());

      await expect(
        dispatchLines(tx as never, {
          invoiceId: 1,
          folio: "F-0001",
          warehouseId: 1,
          lines: [{ productId: 1, presentationId: 10, quantity: 1, unitPrice: 10 }],
          allowManualPrice: true,
        })
      ).rejects.toThrow("no corresponde al producto");
    });

    it("presentación inactiva lanza error en español", async () => {
      tx.product.findMany.mockResolvedValue([product({ productId: 1 })]);
      tx.productPresentation.findMany.mockResolvedValue([
        presentation({ presentationId: 10, productId: 1, isActive: false, name: "Caja 24" }),
      ]);
      getEffectiveLinePrices.mockResolvedValue(new Map());

      await expect(
        dispatchLines(tx as never, {
          invoiceId: 1,
          folio: "F-0001",
          warehouseId: 1,
          lines: [{ productId: 1, presentationId: 10, quantity: 1, unitPrice: 10 }],
          allowManualPrice: true,
        })
      ).rejects.toThrow('La presentación "Caja 24" está inactiva');
    });
  });

  describe("stock insuficiente con presentación", () => {
    it("mensaje en español expresa unidades base y equivalencia", async () => {
      tx.product.findMany.mockResolvedValue([product({ productId: 1, name: "Pasta de tomate", unit: "lata" })]);
      tx.productPresentation.findMany.mockResolvedValue([presentation({ factor: 24, name: "Caja 24" })]);
      tx.stockLevel.updateMany.mockResolvedValue({ count: 0 });
      tx.stockLevel.findUnique.mockResolvedValue({ currentQuantity: 10 });
      getEffectiveLinePrices.mockResolvedValue(
        new Map([[lineKey(1, 10), effectivePriceResult({ finalPrice: 500, factor: 24 })]])
      );

      await expect(
        dispatchLines(tx as never, {
          invoiceId: 1,
          folio: "F-0001",
          warehouseId: 1,
          lines: [{ productId: 1, presentationId: 10, quantity: 1, unitPrice: 500 }],
          allowManualPrice: true,
        })
      ).rejects.toThrow(/Stock insuficiente para Pasta de tomate.*1 Caja 24 = 24 lata/);
    });
  });

  describe("servicios", () => {
    it("no tocan stock (isService true)", async () => {
      tx.product.findMany.mockResolvedValue([product({ isService: true })]);
      tx.productPresentation.findMany.mockResolvedValue([]);
      getEffectiveLinePrices.mockResolvedValue(
        new Map([[lineKey(1, undefined), effectivePriceResult({ finalPrice: 200, factor: 1 })]])
      );

      const result = await dispatchLines(tx as never, {
        invoiceId: 1,
        folio: "F-0001",
        warehouseId: 1,
        lines: [{ productId: 1, quantity: 1, unitPrice: 200 }],
        allowManualPrice: true,
      });

      expect(tx.stockLevel.updateMany).not.toHaveBeenCalled();
      expect(tx.stockLevel.upsert).not.toHaveBeenCalled();
      expect(applyInventoryExit).not.toHaveBeenCalled();
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
      expect(result.lineResults[0].unitCost).toBe(0);
    });
  });

  describe("catch-weight", () => {
    function catchWeightProduct(overrides: Partial<Record<string, unknown>> = {}) {
      return product({
        name: "Queso",
        unit: "kg",
        isCatchWeight: true,
        ...overrides,
      });
    }

    function catchWeightPresentation(overrides: Partial<Record<string, unknown>> = {}) {
      return presentation({
        presentationId: 20,
        name: "Caja",
        factor: 5,
        piecesPerUnit: 5,
        ...overrides,
      });
    }

    it("venta catch-weight ok (1 Caja, piecesPerUnit 5, peso 17.35): baseQuantity, pieces, subtotal y updateMany dual correctos", async () => {
      tx.product.findMany.mockResolvedValue([catchWeightProduct()]);
      tx.productPresentation.findMany.mockResolvedValue([catchWeightPresentation()]);
      tx.stockLevel.updateMany.mockResolvedValue({ count: 1 });
      getEffectiveLinePrices.mockResolvedValue(
        new Map([[lineKey(1, 20), effectivePriceResult({ pricePerBase: 10 })]])
      );

      const result = await dispatchLines(tx as never, {
        invoiceId: 1,
        folio: "F-0001",
        warehouseId: 1,
        customerId: 1,
        lines: [{ productId: 1, presentationId: 20, quantity: 1, unitPrice: 10, actualWeightKg: 17.35 }],
        allowManualPrice: true,
      });

      expect(tx.stockLevel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            productId: 1,
            warehouseId: 1,
            currentQuantity: { gte: 17.35 },
            currentPieces: { gte: 5 },
          }),
          data: expect.objectContaining({
            currentQuantity: { decrement: 17.35 },
            currentPieces: { decrement: 5 },
          }),
        })
      );

      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: 17.35,
            pieces: 5,
            movementType: "exit",
          }),
        })
      );

      expect(result.lineResults[0]).toMatchObject({
        productId: 1,
        presentationId: 20,
        quantity: 1,
        unitPrice: 10,
        pieces: 5,
        baseQuantity: 17.35,
        subtotal: 173.5,
      });
    });

    it("sin actualWeightKg lanza error", async () => {
      tx.product.findMany.mockResolvedValue([catchWeightProduct()]);
      tx.productPresentation.findMany.mockResolvedValue([catchWeightPresentation()]);
      getEffectiveLinePrices.mockResolvedValue(
        new Map([[lineKey(1, 20), effectivePriceResult({ pricePerBase: 10 })]])
      );

      await expect(
        dispatchLines(tx as never, {
          invoiceId: 1,
          folio: "F-0001",
          warehouseId: 1,
          lines: [{ productId: 1, presentationId: 20, quantity: 1, unitPrice: 10 }],
          allowManualPrice: true,
        })
      ).rejects.toThrow("Captura el peso real de Queso");
    });

    it("cantidad fraccional lanza error", async () => {
      tx.product.findMany.mockResolvedValue([catchWeightProduct()]);
      tx.productPresentation.findMany.mockResolvedValue([catchWeightPresentation()]);
      getEffectiveLinePrices.mockResolvedValue(
        new Map([[lineKey(1, 20), effectivePriceResult({ pricePerBase: 10 })]])
      );

      await expect(
        dispatchLines(tx as never, {
          invoiceId: 1,
          folio: "F-0001",
          warehouseId: 1,
          lines: [
            { productId: 1, presentationId: 20, quantity: 1.5, unitPrice: 10, actualWeightKg: 17.35 },
          ],
          allowManualPrice: true,
        })
      ).rejects.toThrow("La cantidad de Queso debe ser un número entero mayor o igual a 1");
    });

    it("producto normal con actualWeightKg lanza error", async () => {
      tx.product.findMany.mockResolvedValue([product()]);
      tx.productPresentation.findMany.mockResolvedValue([]);
      getEffectiveLinePrices.mockResolvedValue(
        new Map([[lineKey(1, undefined), effectivePriceResult({ finalPrice: 20, factor: 1 })]])
      );

      await expect(
        dispatchLines(tx as never, {
          invoiceId: 1,
          folio: "F-0001",
          warehouseId: 1,
          lines: [{ productId: 1, quantity: 1, unitPrice: 20, actualWeightKg: 5 }],
          allowManualPrice: true,
        })
      ).rejects.toThrow("Pasta de tomate no es un producto de peso variable");
    });

    it("presentación sin piecesPerUnit lanza error (debe elegir Pieza o Caja)", async () => {
      tx.product.findMany.mockResolvedValue([catchWeightProduct()]);
      tx.productPresentation.findMany.mockResolvedValue([]);
      getEffectiveLinePrices.mockResolvedValue(
        new Map([[lineKey(1, undefined), effectivePriceResult({ pricePerBase: 10 })]])
      );

      await expect(
        dispatchLines(tx as never, {
          invoiceId: 1,
          folio: "F-0001",
          warehouseId: 1,
          lines: [{ productId: 1, quantity: 1, unitPrice: 10, actualWeightKg: 17.35 }],
          allowManualPrice: true,
        })
      ).rejects.toThrow("El producto Queso es de peso variable: selecciona presentación Pieza o Caja");
    });

    it("stock: kg suficientes pero piezas insuficientes muestra mensaje dual", async () => {
      tx.product.findMany.mockResolvedValue([catchWeightProduct()]);
      tx.productPresentation.findMany.mockResolvedValue([catchWeightPresentation()]);
      tx.stockLevel.updateMany.mockResolvedValue({ count: 0 });
      tx.stockLevel.findUnique.mockResolvedValue({ currentQuantity: 20, currentPieces: 3 });
      getEffectiveLinePrices.mockResolvedValue(
        new Map([[lineKey(1, 20), effectivePriceResult({ pricePerBase: 10 })]])
      );

      await expect(
        dispatchLines(tx as never, {
          invoiceId: 1,
          folio: "F-0001",
          warehouseId: 1,
          lines: [{ productId: 1, presentationId: 20, quantity: 1, unitPrice: 10, actualWeightKg: 17.35 }],
          allowManualPrice: true,
        })
      ).rejects.toThrow(
        "Stock insuficiente de Queso. Disponible: 20 kg / 3 pzas — solicitado: 17.35 kg / 5 pzas"
      );
    });

    describe("venta por piezas registradas (pieceIds)", () => {
      function piece(overrides: Partial<Record<string, unknown>> = {}) {
        return {
          pieceId: 501,
          productId: 1,
          warehouseId: 1,
          status: "available",
          pieceCount: 5,
          weightKg: 17.35,
          label: null,
          salesOrderLineId: null,
          ...overrides,
        };
      }

      it("deriva peso y piezas de los registros y reclama cada pieza con invoiceLineId", async () => {
        tx.product.findMany.mockResolvedValue([catchWeightProduct()]);
        tx.productPresentation.findMany.mockResolvedValue([catchWeightPresentation()]);
        tx.stockLevel.updateMany.mockResolvedValue({ count: 1 });
        tx.productPiece.findMany.mockResolvedValue([
          piece({ pieceId: 501, weightKg: 17.35 }),
          piece({ pieceId: 502, weightKg: 18.05 }),
        ]);
        getEffectiveLinePrices.mockResolvedValue(
          new Map([[lineKey(1, 20), effectivePriceResult({ pricePerBase: 10 })]])
        );

        const result = await dispatchLines(tx as never, {
          invoiceId: 1,
          folio: "F-0001",
          warehouseId: 1,
          customerId: 1,
          lines: [
            { productId: 1, presentationId: 20, quantity: 2, unitPrice: 10, pieceIds: [501, 502] },
          ],
          allowManualPrice: true,
        });

        // 2 cajas × 5 pzas, peso real = suma de los pesos registrados
        expect(result.lineResults[0]).toMatchObject({
          quantity: 2,
          pieces: 10,
          baseQuantity: 35.4,
          subtotal: 354,
        });
        expect(tx.stockLevel.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              currentQuantity: { gte: 35.4 },
              currentPieces: { gte: 10 },
            }),
          })
        );
        expect(tx.productPiece.updateMany).toHaveBeenCalledTimes(2);
        expect(tx.productPiece.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ pieceId: 501, weightKg: 17.35 }),
            data: expect.objectContaining({ status: "sold", invoiceLineId: 100 }),
          })
        );
      });

      it("reclamo fallido (count 0) aborta la venta", async () => {
        tx.product.findMany.mockResolvedValue([catchWeightProduct()]);
        tx.productPresentation.findMany.mockResolvedValue([catchWeightPresentation()]);
        tx.stockLevel.updateMany.mockResolvedValue({ count: 1 });
        tx.productPiece.findMany.mockResolvedValue([piece()]);
        tx.productPiece.updateMany.mockResolvedValue({ count: 0 });
        getEffectiveLinePrices.mockResolvedValue(
          new Map([[lineKey(1, 20), effectivePriceResult({ pricePerBase: 10 })]])
        );

        await expect(
          dispatchLines(tx as never, {
            invoiceId: 1,
            folio: "F-0001",
            warehouseId: 1,
            lines: [{ productId: 1, presentationId: 20, quantity: 1, unitPrice: 10, pieceIds: [501] }],
            allowManualPrice: true,
          })
        ).rejects.toThrow("ya no está disponible");
      });

      it("pieza vendida (status sold) lanza error antes de tocar stock", async () => {
        tx.product.findMany.mockResolvedValue([catchWeightProduct()]);
        tx.productPresentation.findMany.mockResolvedValue([catchWeightPresentation()]);
        tx.productPiece.findMany.mockResolvedValue([piece({ status: "sold" })]);
        getEffectiveLinePrices.mockResolvedValue(
          new Map([[lineKey(1, 20), effectivePriceResult({ pricePerBase: 10 })]])
        );

        await expect(
          dispatchLines(tx as never, {
            invoiceId: 1,
            folio: "F-0001",
            warehouseId: 1,
            lines: [{ productId: 1, presentationId: 20, quantity: 1, unitPrice: 10, pieceIds: [501] }],
            allowManualPrice: true,
          })
        ).rejects.toThrow("ya no está disponible");
        expect(tx.stockLevel.updateMany).not.toHaveBeenCalled();
      });

      it("pieza reservada por la propia línea de pedido webstore sí se acepta", async () => {
        tx.product.findMany.mockResolvedValue([catchWeightProduct()]);
        tx.productPresentation.findMany.mockResolvedValue([catchWeightPresentation()]);
        tx.stockLevel.updateMany.mockResolvedValue({ count: 1 });
        tx.productPiece.findMany.mockResolvedValue([
          piece({ status: "reserved", salesOrderLineId: 77 }),
        ]);
        getEffectiveLinePrices.mockResolvedValue(
          new Map([[lineKey(1, 20), effectivePriceResult({ pricePerBase: 10 })]])
        );

        const result = await dispatchLines(tx as never, {
          invoiceId: 1,
          folio: "F-0001",
          warehouseId: 1,
          lines: [
            {
              productId: 1,
              presentationId: 20,
              quantity: 1,
              unitPrice: 10,
              pieceIds: [501],
              salesOrderLineId: 77,
            },
          ],
          allowManualPrice: true,
        });

        expect(result.lineResults[0]).toMatchObject({ pieces: 5, baseQuantity: 17.35 });
        expect(tx.productPiece.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                { status: "available" },
                { status: "reserved", salesOrderLineId: 77 },
              ]),
            }),
          })
        );
      });

      it("pieza de otro almacén lanza error", async () => {
        tx.product.findMany.mockResolvedValue([catchWeightProduct()]);
        tx.productPresentation.findMany.mockResolvedValue([catchWeightPresentation()]);
        tx.productPiece.findMany.mockResolvedValue([piece({ warehouseId: 9 })]);
        getEffectiveLinePrices.mockResolvedValue(
          new Map([[lineKey(1, 20), effectivePriceResult({ pricePerBase: 10 })]])
        );

        await expect(
          dispatchLines(tx as never, {
            invoiceId: 1,
            folio: "F-0001",
            warehouseId: 1,
            lines: [{ productId: 1, presentationId: 20, quantity: 1, unitPrice: 10, pieceIds: [501] }],
            allowManualPrice: true,
          })
        ).rejects.toThrow("no corresponde al producto o almacén");
      });

      it("pieceCount distinto a piecesPerUnit de la presentación lanza error", async () => {
        tx.product.findMany.mockResolvedValue([catchWeightProduct()]);
        tx.productPresentation.findMany.mockResolvedValue([catchWeightPresentation()]);
        tx.productPiece.findMany.mockResolvedValue([piece({ pieceCount: 1 })]);
        getEffectiveLinePrices.mockResolvedValue(
          new Map([[lineKey(1, 20), effectivePriceResult({ pricePerBase: 10 })]])
        );

        await expect(
          dispatchLines(tx as never, {
            invoiceId: 1,
            folio: "F-0001",
            warehouseId: 1,
            lines: [{ productId: 1, presentationId: 20, quantity: 1, unitPrice: 10, pieceIds: [501] }],
            allowManualPrice: true,
          })
        ).rejects.toThrow("no corresponde a la presentación");
      });

      it("piezas repetidas entre líneas lanza error", async () => {
        tx.product.findMany.mockResolvedValue([catchWeightProduct()]);
        tx.productPresentation.findMany.mockResolvedValue([catchWeightPresentation()]);
        getEffectiveLinePrices.mockResolvedValue(
          new Map([[lineKey(1, 20), effectivePriceResult({ pricePerBase: 10 })]])
        );

        await expect(
          dispatchLines(tx as never, {
            invoiceId: 1,
            folio: "F-0001",
            warehouseId: 1,
            lines: [
              { productId: 1, presentationId: 20, quantity: 1, unitPrice: 10, pieceIds: [501] },
              { productId: 1, presentationId: 20, quantity: 1, unitPrice: 10, pieceIds: [501] },
            ],
            allowManualPrice: true,
          })
        ).rejects.toThrow("Hay piezas repetidas en la venta");
      });

      it("quantity distinto de pieceIds.length lanza error", async () => {
        tx.product.findMany.mockResolvedValue([catchWeightProduct()]);
        tx.productPresentation.findMany.mockResolvedValue([catchWeightPresentation()]);
        tx.productPiece.findMany.mockResolvedValue([piece()]);
        getEffectiveLinePrices.mockResolvedValue(
          new Map([[lineKey(1, 20), effectivePriceResult({ pricePerBase: 10 })]])
        );

        await expect(
          dispatchLines(tx as never, {
            invoiceId: 1,
            folio: "F-0001",
            warehouseId: 1,
            lines: [{ productId: 1, presentationId: 20, quantity: 2, unitPrice: 10, pieceIds: [501] }],
            allowManualPrice: true,
          })
        ).rejects.toThrow("no coincide con las piezas seleccionadas");
      });
    });

    describe("venta desde caja registrada (sourcePieceId)", () => {
      // Presentación Pieza (suelta): la caja registrada agrupa varias.
      function piezaPresentation() {
        return presentation({
          presentationId: 21,
          name: "Pieza",
          factor: 4,
          piecesPerUnit: 1,
        });
      }

      function box(overrides: Partial<Record<string, unknown>> = {}) {
        return {
          pieceId: 601,
          productId: 1,
          warehouseId: 1,
          status: "available",
          pieceCount: 5,
          weightKg: 40,
          label: "L-01",
          salesOrderLineId: null,
          ...overrides,
        };
      }

      function setupBoxSale(boxOverrides: Partial<Record<string, unknown>> = {}) {
        tx.product.findMany.mockResolvedValue([catchWeightProduct({ name: "Lomo" })]);
        tx.productPresentation.findMany.mockResolvedValue([piezaPresentation()]);
        tx.stockLevel.updateMany.mockResolvedValue({ count: 1 });
        tx.productPiece.findMany.mockResolvedValue([box(boxOverrides)]);
        getEffectiveLinePrices.mockResolvedValue(
          new Map([[lineKey(1, 21), effectivePriceResult({ pricePerBase: 1200 })]])
        );
      }

      it("venta parcial: descuenta peso y piezas de la caja sin consumirla", async () => {
        setupBoxSale();

        const result = await dispatchLines(tx as never, {
          invoiceId: 1,
          folio: "F-0001",
          warehouseId: 1,
          lines: [
            {
              productId: 1,
              presentationId: 21,
              quantity: 2,
              unitPrice: 1200,
              actualWeightKg: 15.5,
              sourcePieceId: 601,
            },
          ],
          allowManualPrice: true,
        });

        expect(result.lineResults[0]).toMatchObject({
          pieces: 2,
          baseQuantity: 15.5,
        });
        expect(tx.productPiece.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ pieceId: 601, status: "available", weightKg: 40 }),
            data: expect.objectContaining({ weightKg: 24.5, pieceCount: 3 }),
          })
        );
        // Sin merma residual: solo el decremento dual de la venta
        expect(tx.stockLevel.updateMany).toHaveBeenCalledTimes(1);
      });

      it("caja agotada: pasa a sold con lo vendido y el residuo se merma solo-kg", async () => {
        setupBoxSale({ pieceCount: 2, weightKg: 8 });

        await dispatchLines(tx as never, {
          invoiceId: 1,
          folio: "F-0001",
          warehouseId: 1,
          lines: [
            {
              productId: 1,
              presentationId: 21,
              quantity: 2,
              unitPrice: 1200,
              actualWeightKg: 7.6,
              sourcePieceId: 601,
            },
          ],
          allowManualPrice: true,
        });

        expect(tx.productPiece.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ pieceId: 601, weightKg: 8 }),
            data: expect.objectContaining({
              status: "sold",
              invoiceLineId: 100,
              weightKg: 7.6,
              pieceCount: 2,
            }),
          })
        );
        // Decremento dual de la venta + merma residual solo-kg (0.4)
        expect(tx.stockLevel.updateMany).toHaveBeenCalledTimes(2);
        expect(applyInventoryExit).toHaveBeenCalledWith(
          tx,
          expect.objectContaining({ qty: 0.4 })
        );
        expect(tx.stockMovement.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              movementType: "adjustment",
              quantity: 0.4,
              pieces: null,
              notes: expect.stringContaining("Merma residual"),
            }),
          })
        );
      });

      it("peso vendido mayor al registrado de la caja lanza error", async () => {
        setupBoxSale({ pieceCount: 2, weightKg: 8 });

        await expect(
          dispatchLines(tx as never, {
            invoiceId: 1,
            folio: "F-0001",
            warehouseId: 1,
            lines: [
              {
                productId: 1,
                presentationId: 21,
                quantity: 2,
                unitPrice: 1200,
                actualWeightKg: 9,
                sourcePieceId: 601,
              },
            ],
            allowManualPrice: true,
          })
        ).rejects.toThrow("El peso vendido excede el peso registrado de la caja L-01");
      });

      it("más piezas que las de la caja lanza error", async () => {
        setupBoxSale({ pieceCount: 2, weightKg: 8 });

        await expect(
          dispatchLines(tx as never, {
            invoiceId: 1,
            folio: "F-0001",
            warehouseId: 1,
            lines: [
              {
                productId: 1,
                presentationId: 21,
                quantity: 3,
                unitPrice: 1200,
                actualWeightKg: 7,
                sourcePieceId: 601,
              },
            ],
            allowManualPrice: true,
          })
        ).rejects.toThrow("no tiene suficientes piezas");
      });

      it("pieceIds y sourcePieceId en la misma línea lanza error", async () => {
        setupBoxSale();

        await expect(
          dispatchLines(tx as never, {
            invoiceId: 1,
            folio: "F-0001",
            warehouseId: 1,
            lines: [
              {
                productId: 1,
                presentationId: 21,
                quantity: 1,
                unitPrice: 1200,
                actualWeightKg: 4,
                pieceIds: [601],
                sourcePieceId: 601,
              },
            ],
            allowManualPrice: true,
          })
        ).rejects.toThrow("Hay piezas repetidas en la venta");
      });
    });

    it("stock: piezas suficientes pero kg insuficientes muestra mensaje dual", async () => {
      tx.product.findMany.mockResolvedValue([catchWeightProduct()]);
      tx.productPresentation.findMany.mockResolvedValue([catchWeightPresentation()]);
      tx.stockLevel.updateMany.mockResolvedValue({ count: 0 });
      tx.stockLevel.findUnique.mockResolvedValue({ currentQuantity: 10, currentPieces: 20 });
      getEffectiveLinePrices.mockResolvedValue(
        new Map([[lineKey(1, 20), effectivePriceResult({ pricePerBase: 10 })]])
      );

      await expect(
        dispatchLines(tx as never, {
          invoiceId: 1,
          folio: "F-0001",
          warehouseId: 1,
          lines: [{ productId: 1, presentationId: 20, quantity: 1, unitPrice: 10, actualWeightKg: 17.35 }],
          allowManualPrice: true,
        })
      ).rejects.toThrow(
        "Stock insuficiente de Queso. Disponible: 10 kg / 20 pzas — solicitado: 17.35 kg / 5 pzas"
      );
    });
  });
});

describe("reverseInvoiceStock", () => {
  let tx: MockTx;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = createMockTx();
    tx.stockLevel.upsert.mockResolvedValue({});
    tx.stockMovement.create.mockResolvedValue({ movementId: 2 });
    applyInventoryEntry.mockResolvedValue(undefined);
  });

  it("usa baseQuantity para reingresar 48 (2 cajas de 24)", async () => {
    const results = await reverseInvoiceStock(tx as never, {
      folio: "F-0001",
      warehouseByProductId: new Map([[1, 1]]),
      lines: [{ productId: 1, quantity: 2, baseQuantity: 48, unitCost: 5 }],
    });

    expect(tx.stockLevel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ currentQuantity: 48 }),
        update: expect.objectContaining({ currentQuantity: { increment: 48 } }),
      })
    );
    expect(applyInventoryEntry).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ productId: 1, warehouseId: 1, qty: 48, unitCost: 5 })
    );
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 48 }) })
    );
    expect(results).toEqual([
      { productId: 1, warehouseId: 1, quantity: 2, baseQuantity: 48, unitCost: 5, pieces: null },
    ]);
  });

  it("omite líneas de servicio (unitCost <= 0)", async () => {
    const results = await reverseInvoiceStock(tx as never, {
      folio: "F-0001",
      warehouseByProductId: new Map([[1, 1]]),
      lines: [{ productId: 1, quantity: 1, baseQuantity: 1, unitCost: 0 }],
    });

    expect(tx.stockLevel.upsert).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });

  it("con pieces restaura currentPieces además de currentQuantity", async () => {
    const results = await reverseInvoiceStock(tx as never, {
      folio: "F-0001",
      warehouseByProductId: new Map([[1, 1]]),
      lines: [{ productId: 1, quantity: 1, baseQuantity: 17.35, unitCost: 5, pieces: 5 }],
    });

    expect(tx.stockLevel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ currentQuantity: 17.35, currentPieces: 5 }),
        update: expect.objectContaining({
          currentQuantity: { increment: 17.35 },
          currentPieces: { increment: 5 },
        }),
      })
    );
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 17.35, pieces: 5 }) })
    );
    expect(results).toEqual([
      { productId: 1, warehouseId: 1, quantity: 1, baseQuantity: 17.35, unitCost: 5, pieces: 5 },
    ]);
  });
});
