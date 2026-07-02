import { describe, it, expect, vi, beforeEach } from "vitest";

const { revalidatePath, createAuditLog, requireCurrentUserId, applyInventoryEntry, nextFolio, tx, db } =
  vi.hoisted(() => {
    const tx = {
      purchaseOrder: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      purchaseOrderLine: {
        updateMany: vi.fn(),
        findMany: vi.fn(),
      },
      productPresentation: {
        findUnique: vi.fn(),
      },
      lot: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      lotStock: {
        upsert: vi.fn(),
      },
      goodsReceipt: {
        create: vi.fn(),
      },
      goodsReceiptLine: {
        create: vi.fn(),
      },
      stockMovement: {
        create: vi.fn(),
      },
      stockLevel: {
        upsert: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };

    const db = {
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    };

    return {
      revalidatePath: vi.fn(),
      createAuditLog: vi.fn().mockResolvedValue(undefined),
      requireCurrentUserId: vi.fn().mockResolvedValue(1),
      applyInventoryEntry: vi.fn().mockResolvedValue(undefined),
      nextFolio: vi.fn().mockResolvedValue("REC-0001"),
      tx,
      db,
    };
  });

vi.mock("@/lib/db", () => ({ db }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({ requireCurrentUserId, createAuditLog }));
vi.mock("@/lib/folio", () => ({
  nextFolio,
  DOC_TYPES: { GOODS_RECEIPT: "goods_receipt", PURCHASE_ORDER: "purchase_order" },
}));
vi.mock("@/lib/valuation", () => ({ applyInventoryEntry }));

import { createGoodsReceipt } from "./goods-receipt-actions";

function poLine(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    lineId: 1,
    poId: 1,
    productId: 1,
    quantity: 10,
    unitCost: 240,
    receivedQty: 0,
    presentationId: 10,
    unitFactor: 24,
    baseQuantity: 240,
    presentation: { presentationId: 10, name: "Caja 24", factor: 24 },
    product: { productId: 1, name: "Pasta de tomate", unit: "lata", tracksLots: false },
    ...overrides,
  };
}

function purchaseOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    poId: 1,
    folio: "OC-0001",
    supplierId: 1,
    warehouseId: 1,
    status: "sent",
    lines: [poLine()],
    supplier: { supplierId: 1, name: "Proveedor SA" },
    ...overrides,
  };
}

describe("createGoodsReceipt — conversion a unidad base con presentacion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    requireCurrentUserId.mockResolvedValue(1);
    nextFolio.mockResolvedValue("REC-0001");
    applyInventoryEntry.mockResolvedValue(undefined);

    tx.purchaseOrder.findUnique.mockResolvedValue(purchaseOrder());
    tx.goodsReceipt.create.mockResolvedValue({ receiptId: 1, folio: "REC-0001" });
    tx.purchaseOrderLine.updateMany.mockResolvedValue({ count: 1 });
    tx.purchaseOrderLine.findMany.mockResolvedValue([
      poLine({ receivedQty: 2 }),
    ]);
    tx.goodsReceiptLine.create.mockResolvedValue({ lineId: 1 });
    tx.stockMovement.create.mockResolvedValue({ movementId: 1 });
    tx.stockLevel.upsert.mockResolvedValue({});
    tx.purchaseOrder.update.mockResolvedValue({});
  });

  it("recibir 2 cajas de 24 a $240/caja crea entrada de 48 en base con unitCost 10", async () => {
    const result = await createGoodsReceipt({
      poId: 1,
      lines: [{ poLineId: 1, quantity: 2, unitCost: 240 }],
    });

    expect(result.success).toBe(true);

    expect(applyInventoryEntry).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        productId: 1,
        warehouseId: 1,
        qty: 48,
        unitCost: 10,
      })
    );
  });

  it("crea StockMovement de 48 con nota de equivalencia", async () => {
    await createGoodsReceipt({
      poId: 1,
      lines: [{ poLineId: 1, quantity: 2, unitCost: 240 }],
    });

    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantity: 48,
          movementType: "entry",
          unitCost: 10,
          notes: expect.stringContaining("2 Caja 24 = 48 lata"),
        }),
      })
    );
  });

  it("incrementa receivedQty del PO line en 2 (unidad comprada, no base)", async () => {
    await createGoodsReceipt({
      poId: 1,
      lines: [{ poLineId: 1, quantity: 2, unitCost: 240 }],
    });

    expect(tx.purchaseOrderLine.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lineId: 1, receivedQty: { lte: 8 } }),
        data: { receivedQty: { increment: 2 } },
      })
    );
  });

  it("GoodsReceiptLine guarda presentationId/unitFactor/baseQuantity", async () => {
    await createGoodsReceipt({
      poId: 1,
      lines: [{ poLineId: 1, quantity: 2, unitCost: 240 }],
    });

    expect(tx.goodsReceiptLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantity: 2,
        unitCost: 240,
        presentationId: 10,
        unitFactor: 24,
        baseQuantity: 48,
      }),
    });
  });

  it("StockLevel se incrementa en unidad base (48), no en unidad comprada (2)", async () => {
    await createGoodsReceipt({
      poId: 1,
      lines: [{ poLineId: 1, quantity: 2, unitCost: 240 }],
    });

    expect(tx.stockLevel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ currentQuantity: 48 }),
        update: expect.objectContaining({ currentQuantity: { increment: 48 } }),
      })
    );
  });

  describe("sin presentación (factor 1)", () => {
    beforeEach(() => {
      tx.purchaseOrder.findUnique.mockResolvedValue(
        purchaseOrder({
          lines: [
            poLine({
              presentationId: null,
              unitFactor: 1,
              baseQuantity: 0,
              presentation: null,
              unitCost: 20,
            }),
          ],
        })
      );
    });

    it("se comporta como antes: baseQuantity === quantity, sin nota de equivalencia", async () => {
      await createGoodsReceipt({
        poId: 1,
        lines: [{ poLineId: 1, quantity: 5, unitCost: 20 }],
      });

      expect(applyInventoryEntry).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ qty: 5, unitCost: 20 })
      );
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quantity: 5, notes: "Recepcion OC OC-0001" }),
        })
      );
      expect(tx.goodsReceiptLine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ presentationId: null, unitFactor: 1, baseQuantity: 5 }),
      });
    });
  });

  describe("validación de presentación override", () => {
    it("presentación de otro producto en la recepción lanza error en español", async () => {
      tx.productPresentation.findUnique.mockResolvedValue({
        presentationId: 99,
        productId: 2,
        name: "Caja 12",
        factor: 12,
        isActive: true,
      });

      const result = await createGoodsReceipt({
        poId: 1,
        lines: [{ poLineId: 1, quantity: 1, unitCost: 240, presentationId: 99 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("no corresponde al producto");
      }
    });

    it("presentación inactiva en la recepción lanza error en español", async () => {
      tx.productPresentation.findUnique.mockResolvedValue({
        presentationId: 99,
        productId: 1,
        name: "Caja 12",
        factor: 12,
        isActive: false,
      });

      const result = await createGoodsReceipt({
        poId: 1,
        lines: [{ poLineId: 1, quantity: 1, unitCost: 240, presentationId: 99 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('"Caja 12" está inactiva');
      }
    });
  });

  describe("lote con presentación", () => {
    it("LotStock se incrementa en unidad base", async () => {
      tx.purchaseOrder.findUnique.mockResolvedValue(
        purchaseOrder({
          lines: [poLine({ product: { productId: 1, name: "Pasta", unit: "lata", tracksLots: true } })],
        })
      );
      tx.lot.findUnique.mockResolvedValue(null);
      tx.lot.create.mockResolvedValue({ lotId: 5 });

      await createGoodsReceipt({
        poId: 1,
        lines: [{ poLineId: 1, quantity: 2, unitCost: 240, lotCode: "L1" }],
      });

      expect(tx.lotStock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ quantity: 48 }),
          update: expect.objectContaining({ quantity: { increment: 48 } }),
        })
      );
    });
  });

  describe("cantidad excede lo pendiente", () => {
    it("retorna error de negocio en español si el updateMany no afecta filas", async () => {
      tx.purchaseOrderLine.updateMany.mockResolvedValue({ count: 0 });

      const result = await createGoodsReceipt({
        poId: 1,
        lines: [{ poLineId: 1, quantity: 20, unitCost: 240 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("La cantidad excede lo pendiente por recibir");
      }
    });
  });
});
