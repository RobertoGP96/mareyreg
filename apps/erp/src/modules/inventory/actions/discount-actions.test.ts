import { describe, it, expect, vi, beforeEach } from "vitest";

const { revalidatePath, createAuditLog, requireCurrentUserId, assertRole, tx, db, ForbiddenError } = vi.hoisted(() => {
  class ForbiddenError extends Error {
    constructor(message = "No tienes permisos para realizar esta acción") {
      super(message);
      this.name = "ForbiddenError";
    }
  }

  const tx = {
    discount: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    discountHistory: {
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
vi.mock("../queries/discount-queries", () => ({
  getDiscountHistory: vi.fn().mockResolvedValue([]),
}));

import {
  createDiscount,
  updateDiscount,
  activateDiscount,
  toggleDiscount,
  deleteDiscount,
  getDiscountHistoryAction,
  type DiscountInput,
} from "./discount-actions";

function baseInput(overrides: Partial<DiscountInput> = {}): DiscountInput {
  return {
    name: "Descuento test",
    type: "percent",
    value: 10,
    productId: 1,
    ...overrides,
  };
}

describe("discount-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    requireCurrentUserId.mockResolvedValue(1);
    assertRole.mockResolvedValue(undefined);
    tx.discount.findMany.mockResolvedValue([]);
    tx.discount.updateMany.mockResolvedValue({ count: 0 });
  });

  describe("validate (vía createDiscount)", () => {
    it("percent con value>100 devuelve error en español sin tocar la BD", async () => {
      const result = await createDiscount(baseInput({ type: "percent", value: 150 }));

      expect(result).toEqual({
        success: false,
        error: "El porcentaje de descuento debe estar entre 0 y 100",
      });
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(requireCurrentUserId).not.toHaveBeenCalled();
    });

    it("volume sin minQty devuelve error", async () => {
      const result = await createDiscount(baseInput({ type: "volume", value: 10, minQty: undefined }));

      expect(result).toEqual({
        success: false,
        error: "Los descuentos por volumen requieren una cantidad mínima",
      });
    });

    it("volume con minQty 0 devuelve error", async () => {
      const result = await createDiscount(baseInput({ type: "volume", value: 10, minQty: 0 }));

      expect(result).toEqual({
        success: false,
        error: "Los descuentos por volumen requieren una cantidad mínima",
      });
    });

    it("volume con minQty>0 pasa la validación (continúa hasta la BD)", async () => {
      tx.discount.create.mockResolvedValue({ discountId: 10, productId: 1 });

      const result = await createDiscount(baseInput({ type: "volume", value: 10, minQty: 5 }));

      expect(result.success).toBe(true);
      expect(tx.discount.create).toHaveBeenCalled();
    });
  });

  describe("createDiscount", () => {
    it("crea el descuento, escribe audit e historial dentro de la transacción, y revalida", async () => {
      tx.discount.create.mockResolvedValue({ discountId: 10, productId: 1 });

      const result = await createDiscount(baseInput());

      expect(result).toEqual({ success: true, data: { discountId: 10 } });
      expect(tx.discount.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: "Descuento test" }) })
      );
      expect(createAuditLog).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: "create", entityType: "Discount", entityId: 10 })
      );
      expect(tx.discountHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ discountId: 10, action: "created" }),
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/discounts");
      expect(revalidatePath).toHaveBeenCalledWith("/products");
      expect(revalidatePath).toHaveBeenCalledWith("/webstore/catalogo");
    });
  });

  describe("activateDiscount", () => {
    it("desactiva los OTROS descuentos activos del mismo producto antes de activar el objetivo", async () => {
      tx.discount.findUnique.mockResolvedValue({ discountId: 5, productId: 1, isActive: false });
      tx.discount.findMany.mockResolvedValue([{ discountId: 6 }, { discountId: 7 }]);
      tx.discount.updateMany.mockResolvedValue({ count: 2 });
      tx.discount.update.mockResolvedValue({ discountId: 5 });

      const result = await activateDiscount(5);

      expect(result).toEqual({ success: true, data: undefined });

      // updateMany desactiva hermanos (ids obtenidos via findMany con productId + discountId != id)
      expect(tx.discount.findMany).toHaveBeenCalledWith({
        where: { productId: 1, isActive: true, discountId: { not: 5 } },
        select: { discountId: true },
      });
      expect(tx.discount.updateMany).toHaveBeenCalledWith({
        where: { discountId: { in: [6, 7] } },
        data: { isActive: false, version: { increment: 1 } },
      });
    });

    it("verifica orden: updateMany de hermanos ocurre ANTES del update del objetivo", async () => {
      tx.discount.findUnique.mockResolvedValue({ discountId: 5, productId: 1, isActive: false });
      tx.discount.findMany.mockResolvedValue([{ discountId: 6 }]);
      tx.discount.updateMany.mockResolvedValue({ count: 1 });
      tx.discount.update.mockResolvedValue({ discountId: 5 });

      const callOrder: string[] = [];
      tx.discount.updateMany.mockImplementation(async () => {
        callOrder.push("updateMany");
        return { count: 1 };
      });
      tx.discount.update.mockImplementation(async () => {
        callOrder.push("update");
        return { discountId: 5 };
      });

      await activateDiscount(5);

      expect(callOrder).toEqual(["updateMany", "update"]);
    });

    it("busca hermanos filtrando por productId del objetivo y discountId distinto al activado", async () => {
      tx.discount.findUnique.mockResolvedValue({ discountId: 5, productId: 1, isActive: false });
      tx.discount.findMany.mockResolvedValue([]);
      tx.discount.update.mockResolvedValue({ discountId: 5 });

      await activateDiscount(5);

      expect(tx.discount.findMany).toHaveBeenCalledWith({
        where: { productId: 1, isActive: true, discountId: { not: 5 } },
        select: { discountId: true },
      });
    });

    it("escribe historial 'activated' para el objetivo y 'deactivated' por cada hermano desactivado", async () => {
      tx.discount.findUnique.mockResolvedValue({ discountId: 5, productId: 1, isActive: false });
      tx.discount.findMany.mockResolvedValue([{ discountId: 6 }, { discountId: 7 }]);
      tx.discount.updateMany.mockResolvedValue({ count: 2 });
      tx.discount.update.mockResolvedValue({ discountId: 5 });

      await activateDiscount(5);

      const historyActions = tx.discountHistory.create.mock.calls.map(
        (call) => call[0].data.action
      );
      expect(historyActions).toContain("activated");
      expect(historyActions.filter((a) => a === "deactivated")).toHaveLength(2);
    });

    it("escribe audit log dentro de la transacción", async () => {
      tx.discount.findUnique.mockResolvedValue({ discountId: 5, productId: 1, isActive: false });
      tx.discount.findMany.mockResolvedValue([]);
      tx.discount.update.mockResolvedValue({ discountId: 5 });

      await activateDiscount(5);

      expect(createAuditLog).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: "update", entityType: "Discount", entityId: 5 })
      );
    });

    it("si el descuento no existe devuelve error sin filtrar detalle técnico", async () => {
      tx.discount.findUnique.mockResolvedValue(null);

      const result = await activateDiscount(999);

      expect(result).toEqual({
        success: false,
        error: "El descuento no existe o fue eliminado",
      });
    });
  });

  describe("updateDiscount", () => {
    it("con version que no coincide, updateMany count 0 devuelve error de versión (STALE)", async () => {
      tx.discount.findUnique.mockResolvedValue({
        discountId: 1,
        productId: 1,
        isActive: false,
        version: 3,
      });
      tx.discount.updateMany.mockResolvedValue({ count: 0 });

      const result = await updateDiscount(1, baseInput({ version: 2 }));

      expect(result).toEqual({
        success: false,
        error: "El descuento fue modificado por otra persona. Recarga e intenta de nuevo.",
      });
    });

    it("al reasignar productId de un descuento activo, desactiva hermanos del producto destino", async () => {
      tx.discount.findUnique.mockResolvedValue({
        discountId: 1,
        productId: 1,
        isActive: true,
        version: 0,
      });
      tx.discount.findMany.mockResolvedValue([{ discountId: 8 }]);
      tx.discount.updateMany
        .mockResolvedValueOnce({ count: 1 }) // desactivar hermanos del producto destino
        .mockResolvedValueOnce({ count: 1 }); // update del propio descuento (con version)

      const result = await updateDiscount(1, baseInput({ productId: 2, version: 0 }));

      expect(result.success).toBe(true);
      expect(tx.discount.findMany).toHaveBeenCalledWith({
        where: { productId: 2, isActive: true, discountId: { not: 1 } },
        select: { discountId: true },
      });
      const historyActions = tx.discountHistory.create.mock.calls.map(
        (call) => call[0].data.action
      );
      expect(historyActions).toContain("deactivated");
      expect(historyActions).toContain("updated");
    });

    it("sin reasignar productId (mismo producto) no busca hermanos", async () => {
      tx.discount.findUnique.mockResolvedValue({
        discountId: 1,
        productId: 1,
        isActive: false,
        version: 0,
      });
      tx.discount.update.mockResolvedValue({ discountId: 1 });

      await updateDiscount(1, baseInput({ productId: 1 }));

      expect(tx.discount.findMany).not.toHaveBeenCalled();
    });
  });

  describe("Auth", () => {
    it("createDiscount: requireCurrentUserId lanza 'No autenticado' → mensaje en español, sin filtrar el error crudo", async () => {
      requireCurrentUserId.mockRejectedValue(new Error("No autenticado"));

      const result = await createDiscount(baseInput());

      expect(result).toEqual({
        success: false,
        error: "Debes iniciar sesión para realizar esta acción.",
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("createDiscount: assertRole lanza ForbiddenError → mensaje en español, sin filtrar el error crudo", async () => {
      assertRole.mockRejectedValue(new ForbiddenError());

      const result = await createDiscount(baseInput());

      expect(result).toEqual({
        success: false,
        error: "No tienes permisos para realizar esta acción",
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("activateDiscount: 'No autenticado' propaga mensaje en español", async () => {
      requireCurrentUserId.mockRejectedValue(new Error("No autenticado"));

      const result = await activateDiscount(1);

      expect(result).toEqual({
        success: false,
        error: "Debes iniciar sesión para realizar esta acción.",
      });
    });

    it("activateDiscount: ForbiddenError propaga mensaje en español", async () => {
      assertRole.mockRejectedValue(new ForbiddenError());

      const result = await activateDiscount(1);

      expect(result).toEqual({
        success: false,
        error: "No tienes permisos para realizar esta acción",
      });
    });

    it("updateDiscount: 'No autenticado' propaga mensaje en español", async () => {
      requireCurrentUserId.mockRejectedValue(new Error("No autenticado"));

      const result = await updateDiscount(1, baseInput());

      expect(result).toEqual({
        success: false,
        error: "Debes iniciar sesión para realizar esta acción.",
      });
    });

    it("deleteDiscount: ForbiddenError propaga mensaje en español", async () => {
      assertRole.mockRejectedValue(new ForbiddenError());

      const result = await deleteDiscount(1);

      expect(result).toEqual({
        success: false,
        error: "No tienes permisos para realizar esta acción",
      });
    });

    it("toggleDiscount: 'No autenticado' propaga mensaje en español al desactivar", async () => {
      requireCurrentUserId.mockRejectedValue(new Error("No autenticado"));

      const result = await toggleDiscount(1, false);

      expect(result).toEqual({
        success: false,
        error: "Debes iniciar sesión para realizar esta acción.",
      });
    });

    it("getDiscountHistoryAction: 'No autenticado' propaga mensaje en español", async () => {
      requireCurrentUserId.mockRejectedValue(new Error("No autenticado"));

      const result = await getDiscountHistoryAction(1);

      expect(result).toEqual({
        success: false,
        error: "Debes iniciar sesión para realizar esta acción.",
      });
    });
  });

  describe("toggleDiscount", () => {
    it("isActive=true delega en activateDiscount", async () => {
      tx.discount.findUnique.mockResolvedValue({ discountId: 1, productId: 1, isActive: false });
      tx.discount.findMany.mockResolvedValue([]);
      tx.discount.update.mockResolvedValue({ discountId: 1 });

      const result = await toggleDiscount(1, true);

      expect(result).toEqual({ success: true, data: undefined });
      expect(tx.discount.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: true }) })
      );
    });

    it("isActive=false desactiva y escribe historial 'deactivated'", async () => {
      tx.discount.findUnique.mockResolvedValue({ discountId: 1, productId: 1, isActive: true });
      tx.discount.update.mockResolvedValue({ discountId: 1 });

      const result = await toggleDiscount(1, false);

      expect(result).toEqual({ success: true, data: undefined });
      expect(tx.discount.update).toHaveBeenCalledWith({
        where: { discountId: 1 },
        data: { isActive: false },
      });
      expect(tx.discountHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: "deactivated" }) })
      );
    });
  });

  describe("deleteDiscount", () => {
    it("elimina, escribe audit e historial 'deleted' con productId preservado", async () => {
      tx.discount.findUnique.mockResolvedValue({ discountId: 1, productId: 3, isActive: true });
      tx.discount.delete.mockResolvedValue({ discountId: 1 });

      const result = await deleteDiscount(1);

      expect(result).toEqual({ success: true, data: undefined });
      expect(tx.discount.delete).toHaveBeenCalledWith({ where: { discountId: 1 } });
      expect(tx.discountHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "deleted", productId: 3, discountId: null }),
        })
      );
    });
  });
});
