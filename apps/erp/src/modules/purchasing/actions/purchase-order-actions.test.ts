import { describe, it, expect, vi, beforeEach } from "vitest";

const { revalidatePath, createAuditLog, requireCurrentUserId, nextFolio, tx, db } = vi.hoisted(() => {
  const tx = {
    purchaseOrder: {
      create: vi.fn(),
    },
    productPresentation: {
      findUnique: vi.fn(),
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
    nextFolio: vi.fn().mockResolvedValue("OC-0001"),
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

import { createPurchaseOrder } from "./purchase-order-actions";

const CUP_BASE = {
  id: 1,
  baseCurrencyId: 1,
  baseCurrency: { currencyId: 1, code: "CUP", symbol: "$", decimalPlaces: 0 },
};

function decimalLike(value: number) {
  return { toNumber: () => value };
}

describe("createPurchaseOrder — snapshot de presentación en líneas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    requireCurrentUserId.mockResolvedValue(1);
    nextFolio.mockResolvedValue("OC-0001");
    tx.purchaseOrder.create.mockResolvedValue({ poId: 1, folio: "OC-0001" });
    tx.company.findUnique.mockResolvedValue(CUP_BASE);
  });

  it("sin presentación: factor 1 y baseQuantity === quantity", async () => {
    const result = await createPurchaseOrder({
      supplierId: 1,
      warehouseId: 1,
      orderDate: "2026-01-01",
      lines: [{ productId: 1, quantity: 10, unitCost: 5 }],
    });

    expect(result.success).toBe(true);
    expect(tx.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: {
            create: [
              expect.objectContaining({
                productId: 1,
                quantity: 10,
                unitCost: 5,
                presentationId: null,
                unitFactor: 1,
                baseQuantity: 10,
              }),
            ],
          },
        }),
      })
    );
  });

  it("con presentación válida: guarda el snapshot factor/baseQuantity leído de la BD", async () => {
    tx.productPresentation.findUnique.mockResolvedValue({
      presentationId: 10,
      productId: 1,
      name: "Caja 24",
      factor: 24,
      isActive: true,
    });

    const result = await createPurchaseOrder({
      supplierId: 1,
      warehouseId: 1,
      orderDate: "2026-01-01",
      lines: [{ productId: 1, quantity: 2, unitCost: 240, presentationId: 10 }],
    });

    expect(result.success).toBe(true);
    expect(tx.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: {
            create: [
              expect.objectContaining({
                presentationId: 10,
                unitFactor: 24,
                baseQuantity: 48,
              }),
            ],
          },
        }),
      })
    );
  });

  it("presentación de otro producto: error en español", async () => {
    tx.productPresentation.findUnique.mockResolvedValue({
      presentationId: 10,
      productId: 2,
      name: "Caja 24",
      factor: 24,
      isActive: true,
    });

    const result = await createPurchaseOrder({
      supplierId: 1,
      warehouseId: 1,
      orderDate: "2026-01-01",
      lines: [{ productId: 1, quantity: 2, unitCost: 240, presentationId: 10 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("no corresponde al producto");
    }
  });

  it("presentación inactiva: error en español", async () => {
    tx.productPresentation.findUnique.mockResolvedValue({
      presentationId: 10,
      productId: 1,
      name: "Caja 24",
      factor: 24,
      isActive: false,
    });

    const result = await createPurchaseOrder({
      supplierId: 1,
      warehouseId: 1,
      orderDate: "2026-01-01",
      lines: [{ productId: 1, quantity: 2, unitCost: 240, presentationId: 10 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('"Caja 24" está inactiva');
    }
  });
});

describe("createPurchaseOrder — snapshot de moneda/tasa (Fase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    requireCurrentUserId.mockResolvedValue(1);
    nextFolio.mockResolvedValue("OC-0001");
    tx.purchaseOrder.create.mockResolvedValue({ poId: 1, folio: "OC-0001" });
    tx.company.findUnique.mockResolvedValue(CUP_BASE);
  });

  it("sin currencyId: documento en moneda base, sin snapshot", async () => {
    await createPurchaseOrder({
      supplierId: 1,
      warehouseId: 1,
      orderDate: "2026-01-01",
      lines: [{ productId: 1, quantity: 10, unitCost: 5 }],
    });

    expect(tx.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currencyId: null,
          exchangeRate: null,
          subtotalBase: null,
          totalBase: null,
        }),
      })
    );
  });

  it("currencyId = moneda base: sin snapshot", async () => {
    await createPurchaseOrder({
      supplierId: 1,
      warehouseId: 1,
      currencyId: 1,
      orderDate: "2026-01-01",
      lines: [{ productId: 1, quantity: 10, unitCost: 5 }],
    });

    expect(tx.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currencyId: null, exchangeRate: null }),
      })
    );
    expect(tx.exchangeRate.findUnique).not.toHaveBeenCalled();
  });

  it("currencyId = USD: snapshot de tasa y *Base calculados", async () => {
    tx.exchangeRate.findUnique.mockResolvedValueOnce({
      exchangeRateId: 5,
      rate: decimalLike(380),
    });

    await createPurchaseOrder({
      supplierId: 1,
      warehouseId: 1,
      currencyId: 2,
      orderDate: "2026-01-01",
      lines: [{ productId: 1, quantity: 10, unitCost: 5 }],
    });

    expect(tx.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currencyId: 2,
          exchangeRate: 380,
          subtotalBase: 19000,
          totalBase: 19000,
        }),
      })
    );
  });

  it("sin tasa configurada: error claro en español", async () => {
    tx.exchangeRate.findUnique.mockResolvedValue(null);
    tx.currency.findUnique.mockResolvedValue({ currencyId: 2, code: "USD" });

    const result = await createPurchaseOrder({
      supplierId: 1,
      warehouseId: 1,
      currencyId: 2,
      orderDate: "2026-01-01",
      lines: [{ productId: 1, quantity: 10, unitCost: 5 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("No hay una tasa de cambio configurada entre USD y CUP");
    }
  });
});
