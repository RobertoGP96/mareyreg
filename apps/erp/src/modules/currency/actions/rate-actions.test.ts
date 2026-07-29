import { describe, it, expect, vi, beforeEach } from "vitest";

const { revalidatePath, createAuditLog, requireCurrentUserId, assertRole, tx, db, ForbiddenError } = vi.hoisted(() => {
  class ForbiddenError extends Error {
    constructor(message = "No tienes permisos para realizar esta acción") {
      super(message);
      this.name = "ForbiddenError";
    }
  }

  const tx = {
    exchangeRate: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    exchangeRateHistory: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  const db = {
    exchangeRate: {
      findUnique: vi.fn(),
    },
    exchangeRateHistory: {
      count: vi.fn(),
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

import { createExchangeRate, updateExchangeRate, deleteExchangeRate } from "./rate-actions";

function decimalLike(value: number) {
  return { toNumber: () => value };
}

describe("rate-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    requireCurrentUserId.mockResolvedValue(1);
    assertRole.mockResolvedValue(undefined);
    db.exchangeRate.findUnique.mockResolvedValue(null);
    db.exchangeRateHistory.count.mockResolvedValue(0);
  });

  describe("createExchangeRate", () => {
    it("crea OK, escribe history con oldRate null y audit, y revalida", async () => {
      tx.exchangeRate.create.mockResolvedValue({ exchangeRateId: 10 });

      const result = await createExchangeRate({ baseCurrencyId: 2, quoteCurrencyId: 1, rate: 380 });

      expect(result).toEqual({ success: true, data: { exchangeRateId: 10 } });
      expect(tx.exchangeRateHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ exchangeRateId: 10, oldRate: null, newRate: 380 }),
        })
      );
      expect(createAuditLog).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: "create", entityType: "ExchangeRate", entityId: 10 })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/currency/tasas");
    });

    it("rate <= 0 es rechazado por zod sin llegar a la DB", async () => {
      const result = await createExchangeRate({ baseCurrencyId: 2, quoteCurrencyId: 1, rate: 0 });

      expect(result).toEqual({ success: false, error: "La tasa debe ser mayor a 0" });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("baseCurrencyId igual a quoteCurrencyId es rechazado por zod", async () => {
      const result = await createExchangeRate({ baseCurrencyId: 1, quoteCurrencyId: 1, rate: 380 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Base y destino deben ser monedas distintas");
      }
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("par ya existente devuelve error sin crear", async () => {
      db.exchangeRate.findUnique.mockResolvedValue({ exchangeRateId: 99 });

      const result = await createExchangeRate({ baseCurrencyId: 2, quoteCurrencyId: 1, rate: 380 });

      expect(result).toEqual({
        success: false,
        error: "Ya existe una tasa configurada para ese par de monedas.",
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("usuario no-admin es rechazado por assertRole con ForbiddenError", async () => {
      assertRole.mockRejectedValue(new ForbiddenError());

      const result = await createExchangeRate({ baseCurrencyId: 2, quoteCurrencyId: 1, rate: 380 });

      expect(result).toEqual({
        success: false,
        error: "No tienes permisos para realizar esta acción",
      });
      expect(tx.exchangeRate.create).not.toHaveBeenCalled();
    });
  });

  describe("updateExchangeRate", () => {
    it("actualiza feliz: version coincide, escribe history y audit", async () => {
      const oldRateDecimal = decimalLike(380);
      tx.exchangeRate.findUnique.mockResolvedValue({
        exchangeRateId: 5,
        rate: oldRateDecimal,
        version: 0,
      });
      tx.exchangeRate.updateMany.mockResolvedValue({ count: 1 });

      const result = await updateExchangeRate({
        exchangeRateId: 5,
        rate: 400,
        expectedVersion: 0,
      });

      expect(result).toEqual({ success: true, data: undefined });
      expect(tx.exchangeRate.updateMany).toHaveBeenCalledWith({
        where: { exchangeRateId: 5, version: 0 },
        data: { rate: 400, version: { increment: 1 }, updatedBy: 1 },
      });
      expect(tx.exchangeRateHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ exchangeRateId: 5, oldRate: oldRateDecimal, newRate: 400 }),
        })
      );
      expect(createAuditLog).toHaveBeenCalled();
    });

    it("version stale devuelve error en español sin actualizar history", async () => {
      tx.exchangeRate.findUnique.mockResolvedValue({
        exchangeRateId: 5,
        rate: decimalLike(380),
        version: 2,
      });
      tx.exchangeRate.updateMany.mockResolvedValue({ count: 0 });

      const result = await updateExchangeRate({
        exchangeRateId: 5,
        rate: 400,
        expectedVersion: 0,
      });

      expect(result).toEqual({
        success: false,
        error: "La tasa fue modificada por otro usuario. Recarga la página.",
      });
      expect(tx.exchangeRateHistory.create).not.toHaveBeenCalled();
    });

    it("rate <= 0 es rechazado por zod", async () => {
      const result = await updateExchangeRate({ exchangeRateId: 5, rate: -1, expectedVersion: 0 });

      expect(result).toEqual({ success: false, error: "La tasa debe ser mayor a 0" });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("usuario no-admin es rechazado", async () => {
      assertRole.mockRejectedValue(new ForbiddenError());

      const result = await updateExchangeRate({ exchangeRateId: 5, rate: 400, expectedVersion: 0 });

      expect(result).toEqual({
        success: false,
        error: "No tienes permisos para realizar esta acción",
      });
      expect(tx.exchangeRate.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("deleteExchangeRate", () => {
    it("con más de una fila de historial no elimina", async () => {
      db.exchangeRateHistory.count.mockResolvedValue(2);

      const result = await deleteExchangeRate({ exchangeRateId: 5 });

      expect(result).toEqual({
        success: false,
        error: "No se puede eliminar: esta tasa tiene historial de cambios. Consérvala para auditoría.",
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("con historial <= 1 elimina y audita", async () => {
      db.exchangeRateHistory.count.mockResolvedValue(1);
      tx.exchangeRate.findUnique.mockResolvedValue({ exchangeRateId: 5, rate: decimalLike(380) });

      const result = await deleteExchangeRate({ exchangeRateId: 5 });

      expect(result).toEqual({ success: true, data: undefined });
      expect(tx.exchangeRate.delete).toHaveBeenCalledWith({ where: { exchangeRateId: 5 } });
      expect(createAuditLog).toHaveBeenCalled();
    });
  });
});
