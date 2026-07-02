import { describe, it, expect, vi, beforeEach } from "vitest";

const { revalidatePath, createAuditLog, requireCurrentUserId, assertRole, tx, db, ForbiddenError } = vi.hoisted(() => {
  class ForbiddenError extends Error {
    constructor(message = "No tienes permisos para realizar esta acción") {
      super(message);
      this.name = "ForbiddenError";
    }
  }

  const tx = {
    product: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    productPresentation: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    productPriceHistory: {
      create: vi.fn(),
    },
    presentationPriceHistory: {
      create: vi.fn(),
      count: vi.fn(),
    },
    invoiceLine: {
      count: vi.fn(),
    },
    salesOrderLine: {
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  const db = {
    product: {
      findUnique: vi.fn(),
    },
    productPresentation: {
      findUnique: vi.fn(),
    },
    presentationPriceHistory: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
  };

  return {
    revalidatePath: vi.fn(),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
    requireCurrentUserId: vi.fn().mockResolvedValue(1),
    assertRole: vi.fn().mockResolvedValue(undefined),
    tx,
    db,
    ForbiddenError,
  };
});

vi.mock("@/lib/db", () => ({ db }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({
  requireCurrentUserId,
  createAuditLog,
}));
vi.mock("@/lib/auth-guard", () => ({
  assertRole,
  ForbiddenError,
}));

import {
  createPresentation,
  updatePresentation,
  setPresentationActive,
  deletePresentation,
} from "./presentation-actions";
import type { PresentationCreateInput } from "../lib/presentation-schemas";

function baseCreateInput(overrides: Partial<PresentationCreateInput> = {}): PresentationCreateInput {
  return {
    name: "Caja",
    factor: 12,
    retailPrice: 100,
    ...overrides,
  };
}

describe("presentation-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    requireCurrentUserId.mockResolvedValue(1);
    assertRole.mockResolvedValue(undefined);
    db.product.findUnique.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      if ("productId" in args.where) return { productId: 1 };
      return null; // sku/barcode lookups: sin colisión por defecto
    });
    db.productPresentation.findUnique.mockResolvedValue(null);
    tx.invoiceLine.count.mockResolvedValue(0);
    tx.salesOrderLine.count.mockResolvedValue(0);
    tx.presentationPriceHistory.count.mockResolvedValue(0);
  });

  describe("createPresentation", () => {
    it("crea OK con isBase false, revalida /products y /pos, y escribe audit", async () => {
      tx.productPresentation.create.mockResolvedValue({ presentationId: 10 });

      const result = await createPresentation(1, baseCreateInput());

      expect(result).toEqual({ success: true, data: { presentationId: 10 } });
      expect(tx.productPresentation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ productId: 1, isBase: false }),
        })
      );
      expect(createAuditLog).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: "create", entityType: "ProductPresentation", entityId: 10 })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/products");
      expect(revalidatePath).toHaveBeenCalledWith("/pos");
    });

    it("colisión de barcode contra producto existente devuelve error sin crear", async () => {
      db.product.findUnique.mockImplementation(async (args: { where: Record<string, unknown> }) => {
        if ("productId" in args.where) return { productId: 1 }; // producto destino existe
        if ("barcode" in args.where) return { productId: 99 }; // colisión de barcode
        return null;
      });

      const result = await createPresentation(1, baseCreateInput({ barcode: "7501234567890" }));

      expect(result).toEqual({
        success: false,
        error: "Ya existe un producto con código de barras 7501234567890",
      });
      expect(tx.productPresentation.create).not.toHaveBeenCalled();
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("colisión de barcode contra otra presentación existente devuelve error", async () => {
      db.productPresentation.findUnique.mockResolvedValueOnce({ presentationId: 55 });

      const result = await createPresentation(1, baseCreateInput({ barcode: "7501234567890" }));

      expect(result).toEqual({
        success: false,
        error: "Ya existe una presentación con código de barras 7501234567890",
      });
      expect(tx.productPresentation.create).not.toHaveBeenCalled();
    });
  });

  describe("updatePresentation", () => {
    it("cambio de retailPrice escribe PresentationPriceHistory dentro de la tx", async () => {
      tx.productPresentation.findUnique.mockResolvedValue({
        presentationId: 5,
        productId: 1,
        factor: 1,
        retailPrice: 100,
        wholesalePrice: 80,
        isBase: false,
        sku: null,
        barcode: null,
        product: { productId: 1, costPrice: 50, salePrice: 100 },
      });

      const result = await updatePresentation(5, { retailPrice: 120 });

      expect(result).toEqual({ success: true, data: undefined });
      expect(tx.presentationPriceHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            presentationId: 5,
            oldRetailPrice: 100,
            newRetailPrice: 120,
          }),
        })
      );
    });

    it("cambio de retailPrice en presentación isBase sincroniza product.salePrice y escribe ProductPriceHistory", async () => {
      tx.productPresentation.findUnique.mockResolvedValue({
        presentationId: 1,
        productId: 1,
        factor: 1,
        retailPrice: 100,
        wholesalePrice: null,
        isBase: true,
        sku: null,
        barcode: null,
        product: { productId: 1, costPrice: 50, salePrice: 100 },
      });

      const result = await updatePresentation(1, { retailPrice: 150 });

      expect(result).toEqual({ success: true, data: undefined });
      expect(tx.product.update).toHaveBeenCalledWith({
        where: { productId: 1 },
        data: { salePrice: 150 },
      });
      expect(tx.productPriceHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 1,
            oldSalePrice: 100,
            newSalePrice: 150,
          }),
        })
      );
    });

    it("cambiar factor con ventas registradas devuelve error y NO actualiza", async () => {
      tx.productPresentation.findUnique.mockResolvedValue({
        presentationId: 5,
        productId: 1,
        factor: 1,
        retailPrice: 100,
        wholesalePrice: null,
        isBase: false,
        sku: null,
        barcode: null,
        product: { productId: 1, costPrice: 50, salePrice: 100 },
      });
      tx.invoiceLine.count.mockResolvedValue(3);

      const result = await updatePresentation(5, { factor: 6 });

      expect(result).toEqual({
        success: false,
        error:
          "No se puede modificar el factor de una presentación con ventas registradas. Crea una nueva presentación en su lugar.",
      });
      expect(tx.productPresentation.update).not.toHaveBeenCalled();
    });

    it("cambio de precio con usuario viewer es rechazado por assertRole con ForbiddenError", async () => {
      tx.productPresentation.findUnique.mockResolvedValue({
        presentationId: 5,
        productId: 1,
        factor: 1,
        retailPrice: 100,
        wholesalePrice: null,
        isBase: false,
        sku: null,
        barcode: null,
        product: { productId: 1, costPrice: 50, salePrice: 100 },
      });
      assertRole.mockRejectedValue(new ForbiddenError());

      const result = await updatePresentation(5, { retailPrice: 120 });

      expect(result).toEqual({
        success: false,
        error: "No tienes permisos para realizar esta acción",
      });
      expect(tx.productPresentation.update).not.toHaveBeenCalled();
    });
  });

  describe("setPresentationActive / deletePresentation sobre la base", () => {
    it("setPresentationActive: desactivar la base devuelve error sin llamar a update", async () => {
      tx.productPresentation.findUnique.mockResolvedValue({
        presentationId: 1,
        productId: 1,
        isBase: true,
        isActive: true,
      });

      const result = await setPresentationActive(1, false);

      expect(result).toEqual({
        success: false,
        error: "No se puede desactivar la presentación base del producto",
      });
      expect(tx.productPresentation.update).not.toHaveBeenCalled();
    });

    it("deletePresentation: eliminar la base devuelve error sin llamar a delete", async () => {
      tx.productPresentation.findUnique.mockResolvedValue({
        presentationId: 1,
        productId: 1,
        isBase: true,
      });

      const result = await deletePresentation(1);

      expect(result).toEqual({
        success: false,
        error: "No se puede eliminar la presentación base del producto",
      });
      expect(tx.productPresentation.delete).not.toHaveBeenCalled();
    });
  });

  describe("deletePresentation", () => {
    it("presentación con ventas registradas devuelve error sugiriendo desactivar", async () => {
      tx.productPresentation.findUnique.mockResolvedValue({
        presentationId: 5,
        productId: 1,
        isBase: false,
      });
      tx.salesOrderLine.count.mockResolvedValue(2);

      const result = await deletePresentation(5);

      expect(result).toEqual({
        success: false,
        error: "No se puede eliminar una presentación con ventas registradas. Desactívala en su lugar.",
      });
      expect(tx.productPresentation.delete).not.toHaveBeenCalled();
    });
  });
});
