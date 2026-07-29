import { describe, it, expect, vi, beforeEach } from "vitest";

const { createAuditLog, tx, db, PrismaClientKnownRequestError } = vi.hoisted(() => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    meta?: Record<string, unknown>;
    constructor(message: string, opts: { code: string; meta?: Record<string, unknown> }) {
      super(message);
      this.name = "PrismaClientKnownRequestError";
      this.code = opts.code;
      this.meta = opts.meta;
    }
  }

  const tx = {
    customer: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  const db = {
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
  };

  return {
    createAuditLog: vi.fn().mockResolvedValue(undefined),
    tx,
    db,
    PrismaClientKnownRequestError,
  };
});

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/audit", () => ({ createAuditLog }));
vi.mock("@/generated/prisma", () => ({
  Prisma: { PrismaClientKnownRequestError },
}));

import { upsertWebstoreCustomer } from "./upsert-customer";

function basePayload(overrides = {}) {
  return {
    name: "Juana Pérez",
    phone: "555-123-4567",
    ...overrides,
  };
}

describe("upsertWebstoreCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    tx.customer.findFirst.mockResolvedValue(null);
  });

  it("match por teléfono normalizado: actualiza sin pisar email existente con undefined", async () => {
    tx.customer.findFirst.mockResolvedValueOnce({
      customerId: 10,
      email: "existente@correo.com",
      address: "Calle vieja",
    });
    tx.customer.update.mockResolvedValue({ customerId: 10 });

    const result = await upsertWebstoreCustomer(basePayload(), { apiKeyId: 1 });

    expect(result).toEqual({ customerId: 10, created: false });
    expect(tx.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: 10 },
        data: expect.objectContaining({
          email: "existente@correo.com",
          normalizedPhone: "5551234567",
        }),
      })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: "update", entityType: "Customer", entityId: 10, userId: null })
    );
  });

  it("match por teléfono: usa el email del payload si el existente no tiene", async () => {
    tx.customer.findFirst.mockResolvedValueOnce({
      customerId: 11,
      email: null,
      address: null,
    });
    tx.customer.update.mockResolvedValue({ customerId: 11 });

    const result = await upsertWebstoreCustomer(
      basePayload({ email: "nuevo@correo.com" }),
      { apiKeyId: 1 }
    );

    expect(result).toEqual({ customerId: 11, created: false });
    expect(tx.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "nuevo@correo.com" }),
      })
    );
  });

  it("sin match por teléfono, hace fallback a match por email y adopta source webstore", async () => {
    tx.customer.findFirst
      .mockResolvedValueOnce(null) // por teléfono
      .mockResolvedValueOnce({ customerId: 20, address: null }); // por email
    tx.customer.update.mockResolvedValue({ customerId: 20 });

    const result = await upsertWebstoreCustomer(
      basePayload({ email: "cliente@correo.com" }),
      { apiKeyId: 2 }
    );

    expect(result).toEqual({ customerId: 20, created: false });
    expect(tx.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: 20 },
        data: expect.objectContaining({ source: "webstore" }),
      })
    );
  });

  it("sin match alguno, crea un cliente nuevo con source webstore", async () => {
    tx.customer.create.mockResolvedValue({ customerId: 30 });

    const result = await upsertWebstoreCustomer(basePayload(), { apiKeyId: 3 });

    expect(result).toEqual({ customerId: 30, created: true });
    expect(tx.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "webstore",
          customerType: "retail",
          normalizedPhone: "5551234567",
        }),
      })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: "create", entityType: "Customer", entityId: 30, userId: null })
    );
  });

  it("ante P2002 del índice único de teléfono webstore, re-resuelve por teléfono", async () => {
    const conflictError = new PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      meta: { target: "customers_webstore_phone_unique" },
    });
    db.$transaction.mockImplementationOnce(async () => {
      throw conflictError;
    });
    tx.customer.findFirst.mockResolvedValueOnce({
      customerId: 40,
      email: null,
      address: null,
    });
    tx.customer.update.mockResolvedValue({ customerId: 40 });

    const result = await upsertWebstoreCustomer(basePayload(), { apiKeyId: 4 });

    expect(result).toEqual({ customerId: 40, created: false });
    expect(tx.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: 40 } })
    );
  });

  it("propaga errores que no son el conflicto esperado", async () => {
    const otherError = new Error("boom");
    db.$transaction.mockImplementationOnce(async () => {
      throw otherError;
    });

    await expect(upsertWebstoreCustomer(basePayload(), { apiKeyId: 5 })).rejects.toThrow("boom");
  });
});
