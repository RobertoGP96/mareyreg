import { describe, it, expect, vi, beforeEach } from "vitest";

const { revalidatePath, createAuditLog, requireCurrentUserId, nextFolio, tx, db } = vi.hoisted(() => {
  const tx = {
    purchaseOrder: {
      create: vi.fn(),
    },
    productPresentation: {
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

describe("createPurchaseOrder — snapshot de presentación en líneas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    requireCurrentUserId.mockResolvedValue(1);
    nextFolio.mockResolvedValue("OC-0001");
    tx.purchaseOrder.create.mockResolvedValue({ poId: 1, folio: "OC-0001" });
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
