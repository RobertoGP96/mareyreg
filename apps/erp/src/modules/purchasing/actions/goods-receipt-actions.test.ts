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
      productCost: {
        upsert: vi.fn(),
      },
      product: {
        update: vi.fn(),
      },
      company: {
        findUnique: vi.fn(),
      },
      exchangeRate: {
        findUnique: vi.fn(),
      },
      currency: {
        findUnique: vi.fn(),
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

const CUP_BASE = {
  id: 1,
  baseCurrencyId: 1,
  baseCurrency: { currencyId: 1, code: "CUP", symbol: "$", decimalPlaces: 0 },
};

function decimalLike(value: number) {
  return { toNumber: () => value };
}

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
    currencyId: null,
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
    tx.goodsReceipt.create.mockResolvedValue({ receiptId: 1, folio: "REC-0001", receivedAt: new Date("2026-01-01") });
    tx.purchaseOrderLine.updateMany.mockResolvedValue({ count: 1 });
    tx.purchaseOrderLine.findMany.mockResolvedValue([
      poLine({ receivedQty: 2 }),
    ]);
    tx.goodsReceiptLine.create.mockResolvedValue({ lineId: 1 });
    tx.stockMovement.create.mockResolvedValue({ movementId: 1 });
    tx.stockLevel.upsert.mockResolvedValue({});
    tx.purchaseOrder.update.mockResolvedValue({});
    tx.productCost.upsert.mockResolvedValue({});
    tx.product.update.mockResolvedValue({});
    tx.company.findUnique.mockResolvedValue(CUP_BASE);
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

describe("createGoodsReceipt — costos duales USD/CUP (Fase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    requireCurrentUserId.mockResolvedValue(1);
    nextFolio.mockResolvedValue("REC-0001");
    applyInventoryEntry.mockResolvedValue(undefined);

    tx.goodsReceipt.create.mockResolvedValue({ receiptId: 1, folio: "REC-0001", receivedAt: new Date("2026-01-01") });
    tx.purchaseOrderLine.updateMany.mockResolvedValue({ count: 1 });
    tx.purchaseOrderLine.findMany.mockResolvedValue([poLine({ receivedQty: 2 })]);
    tx.goodsReceiptLine.create.mockResolvedValue({ lineId: 1 });
    tx.stockMovement.create.mockResolvedValue({ movementId: 1 });
    tx.stockLevel.upsert.mockResolvedValue({});
    tx.purchaseOrder.update.mockResolvedValue({});
    tx.productCost.upsert.mockResolvedValue({});
    tx.product.update.mockResolvedValue({});
    tx.company.findUnique.mockResolvedValue(CUP_BASE);
  });

  it("recepcion en moneda base (currencyId null) no setea el trio origCurrencyId/origUnitCost/exchangeRate", async () => {
    tx.purchaseOrder.findUnique.mockResolvedValue(purchaseOrder({ currencyId: null }));

    await createGoodsReceipt({
      poId: 1,
      lines: [{ poLineId: 1, quantity: 2, unitCost: 240 }],
    });

    expect(applyInventoryEntry).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        unitCost: 10,
        origCurrencyId: undefined,
        origUnitCost: undefined,
        exchangeRate: undefined,
      })
    );
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitCost: 10,
          origCurrencyId: null,
          origUnitCost: null,
          exchangeRate: null,
        }),
      })
    );
    expect(tx.goodsReceiptLine.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ unitCostBase: null }) })
    );
    expect(tx.exchangeRate.findUnique).not.toHaveBeenCalled();
  });

  it("recepcion de OC en USD: crea capa/movimiento con unitCost en CUP y trio original correcto", async () => {
    tx.purchaseOrder.findUnique.mockResolvedValue(purchaseOrder({ currencyId: 2 }));
    tx.exchangeRate.findUnique.mockResolvedValueOnce({ exchangeRateId: 5, rate: decimalLike(380) });

    await createGoodsReceipt({
      poId: 1,
      lines: [{ poLineId: 1, quantity: 2, unitCost: 240 }],
    });

    // unitCostPerBase = 240/24 = 10 USD; unitCostBasePerBaseUnit = 10*380 = 3800 CUP
    expect(applyInventoryEntry).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        qty: 48,
        unitCost: 3800,
        origCurrencyId: 2,
        origUnitCost: 10,
        exchangeRate: 380,
      })
    );
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitCost: 3800,
          origCurrencyId: 2,
          origUnitCost: 10,
          exchangeRate: 380,
        }),
      })
    );
    expect(tx.goodsReceiptLine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ unitCost: 240, unitCostBase: 240 * 380 }),
      })
    );
    expect(tx.goodsReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currencyId: 2, exchangeRate: 380 }) })
    );
  });

  it("upsert de ProductCost y espejo Product.costPrice tras recibir en USD", async () => {
    tx.purchaseOrder.findUnique.mockResolvedValue(purchaseOrder({ currencyId: 2 }));
    tx.exchangeRate.findUnique.mockResolvedValueOnce({ exchangeRateId: 5, rate: decimalLike(380) });

    await createGoodsReceipt({
      poId: 1,
      lines: [{ poLineId: 1, quantity: 2, unitCost: 240 }],
    });

    expect(tx.productCost.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: 1 },
        create: expect.objectContaining({
          productId: 1,
          currencyId: 2,
          lastUnitCost: 10,
          lastUnitCostBase: 3800,
          lastExchangeRate: 380,
          lastReceiptId: 1,
        }),
        update: expect.objectContaining({
          currencyId: 2,
          lastUnitCost: 10,
          lastUnitCostBase: 3800,
          lastExchangeRate: 380,
          lastReceiptId: 1,
        }),
      })
    );
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { productId: 1 },
      data: { costPrice: 3800 },
    });
  });

  it("sin tasa configurada: error claro en español y no crea la recepcion", async () => {
    tx.purchaseOrder.findUnique.mockResolvedValue(purchaseOrder({ currencyId: 2 }));
    tx.exchangeRate.findUnique.mockResolvedValue(null);
    tx.currency.findUnique.mockResolvedValue({ currencyId: 2, code: "USD" });

    const result = await createGoodsReceipt({
      poId: 1,
      lines: [{ poLineId: 1, quantity: 2, unitCost: 240 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("No hay una tasa de cambio configurada entre USD y CUP");
    }
    expect(tx.goodsReceiptLine.create).not.toHaveBeenCalled();
  });

  it("recepcion con dos lineas del mismo producto: ProductCost/costPrice reflejan la ULTIMA linea procesada (determinismo)", async () => {
    // Dos lineas de OC distintas (lineId 1 y 2) para el mismo productId,
    // cada una con un costo distinto — simula recibir el mismo producto en
    // dos presentaciones/costos dentro de una sola recepcion.
    tx.purchaseOrder.findUnique.mockResolvedValue(
      purchaseOrder({
        currencyId: null,
        lines: [
          poLine({ lineId: 1, unitCost: 240 }),
          poLine({ lineId: 2, unitCost: 480 }),
        ],
      })
    );
    tx.purchaseOrderLine.findMany.mockResolvedValue([
      poLine({ lineId: 1, unitCost: 240, receivedQty: 2 }),
      poLine({ lineId: 2, unitCost: 480, receivedQty: 1 }),
    ]);

    const result = await createGoodsReceipt({
      poId: 1,
      lines: [
        { poLineId: 1, quantity: 2, unitCost: 240 },
        { poLineId: 2, quantity: 1, unitCost: 480 },
      ],
    });

    expect(result.success).toBe(true);

    // Linea 1: 240/24 = 10 CUP por unidad base. Linea 2: 480/24 = 20 CUP.
    // La ULTIMA linea procesada (poLineId 2) es la que debe quedar reflejada
    // en el espejo Product.costPrice y en el upsert final de ProductCost,
    // sin importar el orden de llegada de las promesas.
    expect(tx.product.update).toHaveBeenLastCalledWith({
      where: { productId: 1 },
      data: { costPrice: 20 },
    });
    expect(tx.productCost.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { productId: 1 },
        update: expect.objectContaining({ lastUnitCost: 20, lastUnitCostBase: 20 }),
      })
    );
  });
});

describe("createGoodsReceipt — catch-weight (peso variable)", () => {
  function catchWeightPoLine(overrides: Partial<Record<string, unknown>> = {}) {
    return poLine({
      productId: 1,
      quantity: 5,
      unitCost: 8, // $/kg
      presentationId: 20,
      unitFactor: 5, // peso nominal por caja (kg) — solo estimacion
      presentation: { presentationId: 20, name: "Caja", factor: 5, piecesPerUnit: 2 },
      product: {
        productId: 1,
        name: "Queso gouda",
        unit: "kg",
        tracksLots: false,
        isCatchWeight: true,
      },
      ...overrides,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    requireCurrentUserId.mockResolvedValue(1);
    nextFolio.mockResolvedValue("REC-0001");
    applyInventoryEntry.mockResolvedValue(undefined);

    tx.purchaseOrder.findUnique.mockResolvedValue(
      purchaseOrder({ lines: [catchWeightPoLine()] })
    );
    tx.goodsReceipt.create.mockResolvedValue({
      receiptId: 1,
      folio: "REC-0001",
      receivedAt: new Date("2026-01-01"),
    });
    tx.purchaseOrderLine.updateMany.mockResolvedValue({ count: 1 });
    tx.purchaseOrderLine.findMany.mockResolvedValue([catchWeightPoLine({ receivedQty: 2 })]);
    tx.goodsReceiptLine.create.mockResolvedValue({ lineId: 1 });
    tx.stockMovement.create.mockResolvedValue({ movementId: 1 });
    tx.stockLevel.upsert.mockResolvedValue({});
    tx.purchaseOrder.update.mockResolvedValue({});
    tx.productCost.upsert.mockResolvedValue({});
    tx.product.update.mockResolvedValue({});
    tx.company.findUnique.mockResolvedValue(CUP_BASE);
  });

  it("2 cajas (2 pzas c/u) con pesos reales: baseQuantity = suma de pesos, pieces = 4, unitCost pasa tal cual ($/kg)", async () => {
    const result = await createGoodsReceipt({
      poId: 1,
      lines: [
        {
          poLineId: 1,
          quantity: 2,
          unitCost: 8,
          pieceWeights: [4.2, 3.8, 4.5, 4.15],
        },
      ],
    });

    expect(result.success).toBe(true);

    const totalWeight = 4.2 + 3.8 + 4.5 + 4.15; // 16.65
    expect(applyInventoryEntry).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        productId: 1,
        warehouseId: 1,
        qty: totalWeight,
        unitCost: 8, // no se divide entre el factor nominal
      })
    );

    expect(tx.goodsReceiptLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantity: 2,
        pieces: 4,
        pieceWeights: [4.2, 3.8, 4.5, 4.15],
        baseQuantity: totalWeight,
      }),
    });

    expect(tx.stockLevel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ currentQuantity: totalWeight, currentPieces: 4 }),
        update: expect.objectContaining({
          currentQuantity: { increment: totalWeight },
          currentPieces: { increment: 4 },
        }),
      })
    );

    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: totalWeight, pieces: 4, unitCost: 8 }),
      })
    );
  });

  it("pieceWeights.length distinto al esperado retorna error claro", async () => {
    const result = await createGoodsReceipt({
      poId: 1,
      lines: [
        {
          poLineId: 1,
          quantity: 2,
          unitCost: 8,
          pieceWeights: [4.2, 3.8, 4.5], // se esperaban 4
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Se esperaban 4 pesos");
    }
    expect(tx.goodsReceiptLine.create).not.toHaveBeenCalled();
  });

  it("peso <= 0 en alguna pieza retorna error claro", async () => {
    const result = await createGoodsReceipt({
      poId: 1,
      lines: [
        {
          poLineId: 1,
          quantity: 2,
          unitCost: 8,
          pieceWeights: [4.2, 0, 4.5, 4.15],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Captura el peso de cada pieza");
    }
    expect(tx.goodsReceiptLine.create).not.toHaveBeenCalled();
  });

  it("producto catch-weight sin pieceWeights retorna error claro", async () => {
    const result = await createGoodsReceipt({
      poId: 1,
      lines: [{ poLineId: 1, quantity: 2, unitCost: 8 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Captura el peso de cada pieza");
    }
    expect(tx.goodsReceiptLine.create).not.toHaveBeenCalled();
  });

  it("producto normal con pieceWeights retorna error claro (regresion)", async () => {
    tx.purchaseOrder.findUnique.mockResolvedValue(purchaseOrder({ lines: [poLine()] }));
    tx.purchaseOrderLine.findMany.mockResolvedValue([poLine({ receivedQty: 2 })]);

    const result = await createGoodsReceipt({
      poId: 1,
      lines: [{ poLineId: 1, quantity: 2, unitCost: 240, pieceWeights: [1, 2] }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("no es de peso variable");
    }
    expect(tx.goodsReceiptLine.create).not.toHaveBeenCalled();
  });

  it("producto normal (no catch-weight) sigue funcionando igual: pieces null, pieceWeights undefined", async () => {
    tx.purchaseOrder.findUnique.mockResolvedValue(purchaseOrder({ lines: [poLine()] }));
    tx.purchaseOrderLine.findMany.mockResolvedValue([poLine({ receivedQty: 2 })]);

    await createGoodsReceipt({
      poId: 1,
      lines: [{ poLineId: 1, quantity: 2, unitCost: 240 }],
    });

    expect(tx.goodsReceiptLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ pieces: null, pieceWeights: undefined, baseQuantity: 48 }),
    });
    expect(tx.stockLevel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ currentPieces: 0 }),
      })
    );
  });
});
