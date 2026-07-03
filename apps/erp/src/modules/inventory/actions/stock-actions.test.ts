import { describe, it, expect, vi, beforeEach } from "vitest";

const { revalidatePath, createAuditLog, requireCurrentUserId, tx, db } = vi.hoisted(() => {
  const tx = {
    product: {
      findUnique: vi.fn(),
    },
    productPresentation: {
      findUnique: vi.fn(),
    },
    stockLevel: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
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
    tx,
    db,
  };
});

vi.mock("@/lib/db", () => ({ db }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({
  requireCurrentUserId,
  createAuditLog,
}));
vi.mock("@/lib/valuation", () => ({
  applyInventoryEntry: vi.fn().mockResolvedValue(undefined),
  applyInventoryExit: vi.fn().mockResolvedValue({ avgCostUsed: 10 }),
  applyInventoryTransfer: vi.fn().mockResolvedValue({ avgCostUsed: 10 }),
}));

import { createStockMovement, createStockTransfer } from "./stock-actions";
import {
  applyInventoryEntry,
  applyInventoryExit,
  applyInventoryTransfer,
} from "@/lib/valuation";

const NORMAL_PRODUCT = { allowNegative: false, unit: "kg", isCatchWeight: false };
const CATCH_WEIGHT_PRODUCT = { allowNegative: false, unit: "kg", isCatchWeight: true };

describe("stock-actions (catch-weight)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    requireCurrentUserId.mockResolvedValue(1);
    tx.productPresentation.findUnique.mockResolvedValue(null);
    tx.stockMovement.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      movementId: 1,
      ...args.data,
    }));
    (applyInventoryEntry as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (applyInventoryExit as ReturnType<typeof vi.fn>).mockResolvedValue({ avgCostUsed: 10 });
    (applyInventoryTransfer as ReturnType<typeof vi.fn>).mockResolvedValue({ avgCostUsed: 10 });
  });

  describe("createStockMovement — producto normal (regresión)", () => {
    it("entry sin pieces funciona igual que antes", async () => {
      tx.product.findUnique.mockResolvedValue(NORMAL_PRODUCT);
      tx.stockLevel.upsert.mockResolvedValue({});

      const result = await createStockMovement({
        productId: 1,
        warehouseId: 1,
        quantity: 10,
        movementType: "entry",
      });

      expect(result.success).toBe(true);
      expect(tx.stockLevel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ currentQuantity: 10, currentPieces: 0 }),
        })
      );
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pieces: null }) })
      );
    });

    it("producto normal con pieces en el input devuelve error y no muta stock", async () => {
      tx.product.findUnique.mockResolvedValue(NORMAL_PRODUCT);

      const result = await createStockMovement({
        productId: 1,
        warehouseId: 1,
        quantity: 10,
        movementType: "entry",
        pieces: 5,
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("no debe indicar piezas"),
      });
      expect(tx.stockLevel.upsert).not.toHaveBeenCalled();
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });
  });

  describe("createStockMovement — catch-weight: ajuste dual", () => {
    it("ajuste positivo con peso y piezas mueve ambos juntos", async () => {
      tx.product.findUnique.mockResolvedValue(CATCH_WEIGHT_PRODUCT);
      tx.stockLevel.upsert.mockResolvedValue({});

      const result = await createStockMovement({
        productId: 2,
        warehouseId: 1,
        quantity: 17.35,
        movementType: "adjustment",
        adjustmentSign: "positive",
        pieces: 3,
      });

      expect(result.success).toBe(true);
      expect(tx.stockLevel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ currentQuantity: 17.35, currentPieces: 3 }),
        })
      );
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quantity: 17.35, pieces: 3 }),
        })
      );
    });

    it("merma solo-kg (pieces=0 explícito) mueve kg sin tocar piezas", async () => {
      tx.product.findUnique.mockResolvedValue(CATCH_WEIGHT_PRODUCT);
      tx.stockLevel.updateMany.mockResolvedValue({ count: 1 });

      const result = await createStockMovement({
        productId: 2,
        warehouseId: 1,
        quantity: 1.2,
        movementType: "adjustment",
        adjustmentSign: "negative",
        pieces: 0,
      });

      expect(result.success).toBe(true);
      // delta negativo y allowNegative=false => pasa por updateMany
      // condicional; piecesDelta=0 no agrega condicion de piezas ni las
      // incrementa (el contador de piezas queda intacto).
      expect(tx.stockLevel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 2, warehouseId: 1, currentQuantity: { gte: 1.2 } },
          data: expect.objectContaining({ currentQuantity: { increment: -1.2 } }),
        })
      );
      const updateManyCall = tx.stockLevel.updateMany.mock.calls[0][0];
      expect(updateManyCall.data.currentPieces).toBeUndefined();
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pieces: null }) })
      );
    });

    it("adjustment catch-weight sin pieces en el input devuelve error", async () => {
      tx.product.findUnique.mockResolvedValue(CATCH_WEIGHT_PRODUCT);

      const result = await createStockMovement({
        productId: 2,
        warehouseId: 1,
        quantity: 5,
        movementType: "adjustment",
        adjustmentSign: "positive",
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Debe indicar las piezas"),
      });
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it("entry catch-weight con pieces=0 es rechazado (mínimo 1 en entry/exit)", async () => {
      tx.product.findUnique.mockResolvedValue(CATCH_WEIGHT_PRODUCT);

      const result = await createStockMovement({
        productId: 2,
        warehouseId: 1,
        quantity: 5,
        movementType: "entry",
        pieces: 0,
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("mayor o igual a 1"),
      });
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });
  });

  describe("createStockMovement — catch-weight: piezas insuficientes", () => {
    it("exit con piezas insuficientes devuelve error dual y no muta stock", async () => {
      tx.product.findUnique.mockResolvedValue(CATCH_WEIGHT_PRODUCT);
      tx.stockLevel.updateMany.mockResolvedValue({ count: 0 });
      tx.stockLevel.findUnique.mockResolvedValue({ currentQuantity: 20, currentPieces: 2 });

      const result = await createStockMovement({
        productId: 2,
        warehouseId: 1,
        quantity: 10,
        movementType: "exit",
        pieces: 5,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("kg");
        expect(result.error).toContain("pzas");
      }
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
      expect(applyInventoryExit).not.toHaveBeenCalled();
    });
  });

  describe("createStockTransfer — catch-weight dual", () => {
    it("transferencia mueve kg y piezas en ambos almacenes", async () => {
      tx.product.findUnique.mockResolvedValue(CATCH_WEIGHT_PRODUCT);
      tx.stockLevel.updateMany.mockResolvedValue({ count: 1 });
      tx.stockLevel.upsert.mockResolvedValue({});

      const result = await createStockTransfer({
        productId: 2,
        warehouseIdFrom: 1,
        warehouseIdTo: 2,
        quantity: 12.5,
        pieces: 4,
      });

      expect(result.success).toBe(true);
      expect(tx.stockLevel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            productId: 2,
            warehouseId: 1,
            currentQuantity: { gte: 12.5 },
            currentPieces: { gte: 4 },
          }),
        })
      );
      expect(tx.stockLevel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ currentQuantity: 12.5, currentPieces: 4 }),
        })
      );
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(2);
      for (const call of tx.stockMovement.create.mock.calls) {
        expect(call[0].data.pieces).toBe(4);
      }
    });

    it("transferencia catch-weight sin pieces devuelve error", async () => {
      tx.product.findUnique.mockResolvedValue(CATCH_WEIGHT_PRODUCT);

      const result = await createStockTransfer({
        productId: 2,
        warehouseIdFrom: 1,
        warehouseIdTo: 2,
        quantity: 12.5,
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Debe indicar las piezas"),
      });
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it("producto normal intacto: transferencia sin pieces sigue funcionando", async () => {
      tx.product.findUnique.mockResolvedValue(NORMAL_PRODUCT);
      tx.stockLevel.updateMany.mockResolvedValue({ count: 1 });
      tx.stockLevel.upsert.mockResolvedValue({});

      const result = await createStockTransfer({
        productId: 1,
        warehouseIdFrom: 1,
        warehouseIdTo: 2,
        quantity: 10,
      });

      expect(result.success).toBe(true);
      expect(tx.stockLevel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 1, warehouseId: 1, currentQuantity: { gte: 10 } },
        })
      );
    });
  });
});
