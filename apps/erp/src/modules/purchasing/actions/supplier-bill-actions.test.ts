import { describe, it, expect, vi, beforeEach } from "vitest";

const { revalidatePath, createAuditLog, requireCurrentUserId, assertRole, nextFolio, tx, db } = vi.hoisted(() => {
  const tx = {
    purchaseOrder: {
      findUnique: vi.fn(),
    },
    supplierBill: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    supplierPayment: {
      create: vi.fn(),
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
    assertRole: vi.fn().mockResolvedValue(undefined),
    nextFolio: vi.fn().mockResolvedValue("FAC-0001"),
    tx,
    db,
  };
});

vi.mock("@/lib/db", () => ({ db }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({ requireCurrentUserId, createAuditLog }));
vi.mock("@/lib/auth-guard", () => ({
  assertRole,
  ForbiddenError: class ForbiddenError extends Error {},
}));
vi.mock("@/lib/folio", () => ({
  nextFolio,
  DOC_TYPES: { SUPPLIER_BILL: "supplier_bill" },
}));

import { createSupplierBill, registerSupplierPayment } from "./supplier-bill-actions";

const CUP_BASE = {
  id: 1,
  baseCurrencyId: 1,
  baseCurrency: { currencyId: 1, code: "CUP", symbol: "$", decimalPlaces: 0 },
};

function decimalLike(value: number) {
  return { toNumber: () => value, valueOf: () => value };
}

describe("createSupplierBill — snapshot de moneda/tasa (Fase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    requireCurrentUserId.mockResolvedValue(1);
    nextFolio.mockResolvedValue("FAC-0001");
    tx.supplierBill.create.mockResolvedValue({ billId: 1, folio: "FAC-0001" });
    tx.company.findUnique.mockResolvedValue(CUP_BASE);
  });

  it("sin currencyId: factura en moneda base, sin snapshot", async () => {
    await createSupplierBill({
      supplierId: 1,
      issueDate: "2026-01-01",
      total: 100,
    });

    expect(tx.supplierBill.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currencyId: null, exchangeRate: null, totalBase: null }),
      })
    );
  });

  it("currencyId = USD: snapshot de tasa y totalBase calculado", async () => {
    tx.exchangeRate.findUnique.mockResolvedValueOnce({ exchangeRateId: 5, rate: decimalLike(380) });

    await createSupplierBill({
      supplierId: 1,
      issueDate: "2026-01-01",
      total: 100,
      currencyId: 2,
    });

    expect(tx.supplierBill.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currencyId: 2, exchangeRate: 380, totalBase: 38000 }),
      })
    );
  });

  it("hereda la moneda de la OC cuando no se especifica currencyId explicito", async () => {
    tx.purchaseOrder.findUnique.mockResolvedValue({
      poId: 9,
      supplierId: 1,
      currencyId: 2,
      bills: [],
    });
    tx.exchangeRate.findUnique.mockResolvedValueOnce({ exchangeRateId: 5, rate: decimalLike(380) });

    await createSupplierBill({
      supplierId: 1,
      purchaseOrderId: 9,
      issueDate: "2026-01-01",
      total: 100,
    });

    expect(tx.supplierBill.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currencyId: 2, exchangeRate: 380, totalBase: 38000 }),
      })
    );
  });

  it("sin tasa configurada: error claro en español", async () => {
    tx.exchangeRate.findUnique.mockResolvedValue(null);
    tx.currency.findUnique.mockResolvedValue({ currencyId: 2, code: "USD" });

    const result = await createSupplierBill({
      supplierId: 1,
      issueDate: "2026-01-01",
      total: 100,
      currencyId: 2,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("No hay una tasa de cambio configurada entre USD y CUP");
    }
  });
});

describe("registerSupplierPayment — conversion via base (Fase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    requireCurrentUserId.mockResolvedValue(1);
    tx.company.findUnique.mockResolvedValue(CUP_BASE);
    tx.supplierBill.updateMany.mockResolvedValue({ count: 1 });
    tx.supplierPayment.create.mockResolvedValue({ paymentId: 1 });
  });

  it("moneda entregada = moneda de la factura (base): amount = amountTendered", async () => {
    tx.supplierBill.findUnique.mockResolvedValue({
      billId: 1,
      total: decimalLike(100),
      paid: decimalLike(0),
      status: "open",
      version: 0,
      currencyId: null,
    });

    const result = await registerSupplierPayment({
      billId: 1,
      amount: 50,
      method: "cash",
      paymentDate: "2026-01-01",
    });

    expect(result.success).toBe(true);
    expect(tx.supplierBill.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paid: 50 }) })
    );
    expect(tx.supplierPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 50, currencyId: null, amountTendered: null, exchangeRate: null }),
      })
    );
  });

  it("factura en USD, pago entregado en USD: amount = amountTendered, exchangeRate de referencia", async () => {
    tx.supplierBill.findUnique.mockResolvedValue({
      billId: 1,
      total: decimalLike(100),
      paid: decimalLike(0),
      status: "open",
      version: 0,
      currencyId: 2,
    });
    tx.exchangeRate.findUnique.mockResolvedValueOnce({ exchangeRateId: 5, rate: decimalLike(380) });

    const result = await registerSupplierPayment({
      billId: 1,
      amount: 50,
      method: "cash",
      paymentDate: "2026-01-01",
      currencyId: 2,
      amountTendered: 50,
    });

    expect(result.success).toBe(true);
    expect(tx.supplierBill.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paid: 50 }) })
    );
    expect(tx.supplierPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 50, currencyId: 2, amountTendered: 50, exchangeRate: 380 }),
      })
    );
  });

  it("factura en USD, pago entregado en CUP: convierte via base con las dos tasas", async () => {
    tx.supplierBill.findUnique.mockResolvedValue({
      billId: 1,
      total: decimalLike(100), // 100 USD
      paid: decimalLike(0),
      status: "open",
      version: 0,
      currencyId: 2, // USD
    });
    // tenderedSnapshot: CUP -> base (CUP), identidad, rate=1
    // billSnapshot: USD -> base (CUP), rate=380
    tx.exchangeRate.findUnique.mockResolvedValueOnce({ exchangeRateId: 5, rate: decimalLike(380) });

    const result = await registerSupplierPayment({
      billId: 1,
      amount: 1, // validacion inicial solo exige > 0; el amount real se deriva de amountTendered dentro de la tx
      method: "cash",
      paymentDate: "2026-01-01",
      currencyId: 1, // CUP (moneda base)
      amountTendered: 3800,
    });

    expect(result.success).toBe(true);
    // amountBase = 3800 * 1 = 3800 CUP; amount (en USD, moneda de la factura) = 3800 / 380 = 10
    expect(tx.supplierBill.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paid: 10 }) })
    );
    expect(tx.supplierPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 10, currencyId: 1, amountTendered: 3800, exchangeRate: 1 }),
      })
    );
  });

  it("moneda entregada distinta sin amountTendered: error en español", async () => {
    tx.supplierBill.findUnique.mockResolvedValue({
      billId: 1,
      total: decimalLike(100),
      paid: decimalLike(0),
      status: "open",
      version: 0,
      currencyId: 2,
    });

    const result = await registerSupplierPayment({
      billId: 1,
      amount: 50,
      method: "cash",
      paymentDate: "2026-01-01",
      currencyId: 1,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("El monto entregado debe ser mayor a 0");
    }
  });
});
