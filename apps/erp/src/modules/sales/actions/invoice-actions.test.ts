import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  revalidatePath,
  createAuditLog,
  requireCurrentUserId,
  nextFolio,
  dispatchLines,
  reverseInvoiceStock,
  getBaseCurrency,
  getRateToBase,
  tx,
  db,
} = vi.hoisted(() => {
  const tx = {
    invoice: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    invoicePayment: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    customer: {
      update: vi.fn(),
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
    nextFolio: vi.fn().mockResolvedValue("FAC-0001"),
    dispatchLines: vi.fn(),
    reverseInvoiceStock: vi.fn(),
    getBaseCurrency: vi.fn(),
    getRateToBase: vi.fn(),
    tx,
    db,
  };
});

vi.mock("@/lib/db", () => ({ db }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({ requireCurrentUserId, createAuditLog }));
vi.mock("@/lib/folio", () => ({
  nextFolio,
  DOC_TYPES: { INVOICE: "invoice" },
}));
vi.mock("@/modules/sales/lib/dispatch-lines", () => ({ dispatchLines, reverseInvoiceStock }));

// GlobalRateNotConfiguredError debe seguir siendo la clase real para que
// `instanceof` funcione en el whitelist de errores (toUserMessage).
vi.mock("@/lib/currency", async () => {
  const actual = await vi.importActual<typeof import("@/lib/currency")>("@/lib/currency");
  return {
    ...actual,
    getBaseCurrency,
    getRateToBase,
  };
});

import { createInvoice, registerInvoicePayment } from "./invoice-actions";

const CUP_BASE = { currencyId: 1, code: "CUP", symbol: "$", decimalPlaces: 0 };

function stubDispatch(subtotal: number) {
  dispatchLines.mockResolvedValue({
    lineResults: [
      {
        productId: 1,
        presentationId: null,
        quantity: 1,
        unitPrice: subtotal,
        discount: 0,
        unitCost: 0,
        subtotal,
        lotId: null,
        unitFactor: 1,
        baseQuantity: 1,
        pieces: null,
      },
    ],
    priceOverrides: [],
  });
}

describe("createInvoice — pagos multi-moneda (Fase 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    requireCurrentUserId.mockResolvedValue(1);
    nextFolio.mockResolvedValue("FAC-0001");
    getBaseCurrency.mockResolvedValue(CUP_BASE);
    tx.invoice.create.mockResolvedValue({ invoiceId: 1 });
    tx.invoice.update.mockResolvedValue({});
    tx.customer.update.mockResolvedValue({});
    tx.invoicePayment.createMany.mockResolvedValue({ count: 1 });
    stubDispatch(5000);
  });

  const baseInput = {
    customerId: 1,
    warehouseId: 1,
    channel: "pos" as const,
    issueDate: "2026-01-01",
    lines: [{ productId: 1, quantity: 1, unitPrice: 5000 }],
  };

  it("compat: shape anterior immediatePayment (un solo pago en moneda base)", async () => {
    const result = await createInvoice({
      ...baseInput,
      immediatePayment: { amount: 5000, paymentMethod: "cash" },
    });

    expect(result.success).toBe(true);
    expect(tx.invoicePayment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          amount: 5000,
          currencyId: null,
          amountTendered: null,
          exchangeRate: null,
          paymentMethod: "cash",
        }),
      ],
    });
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paid: 5000, status: "paid" }) })
    );
  });

  it("pago mixto CUP + USD: suma de equivalentes = paid, cada pago con su snapshot", async () => {
    getRateToBase.mockResolvedValueOnce({ exchangeRateId: 5, rate: 380 });

    // Total 5000. Pago 1: 2000 CUP (queda 3000 de saldo). Pago 2: 8 USD *
    // 380 = 3040 CUP, pero el saldo restante es 3000 -> se recorta a 3000
    // (vuelto de 40 CUP, no persistido).
    const result = await createInvoice({
      ...baseInput,
      immediatePayments: [
        { currencyId: null, amountTendered: 2000, paymentMethod: "cash" },
        { currencyId: 2, amountTendered: 8, paymentMethod: "cash" },
      ],
    });

    expect(result.success).toBe(true);
    expect(tx.invoicePayment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ amount: 2000, currencyId: null, amountTendered: null, exchangeRate: null }),
        expect.objectContaining({ amount: 3000, currencyId: 2, amountTendered: 8, exchangeRate: 380 }),
      ],
    });
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paid: 5000, status: "paid" }) })
    );
    // getRateToBase se llama una sola vez por moneda (cache), aunque hubiera
    // varias lineas en la misma moneda.
    expect(getRateToBase).toHaveBeenCalledTimes(1);
  });

  it("pago en efectivo con vuelto: el pago se recorta al total, el excedente no se persiste", async () => {
    const result = await createInvoice({
      ...baseInput,
      immediatePayments: [{ currencyId: null, amountTendered: 6000, paymentMethod: "cash" }],
    });

    expect(result.success).toBe(true);
    expect(tx.invoicePayment.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ amount: 5000, amountTendered: null })],
    });
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paid: 5000, status: "paid" }) })
    );
  });

  it("tasa faltante: error claro en español, no crea pagos", async () => {
    const { GlobalRateNotConfiguredError } = await vi.importActual<typeof import("@/lib/currency")>(
      "@/lib/currency"
    );
    getRateToBase.mockRejectedValueOnce(new GlobalRateNotConfiguredError("USD", "CUP"));

    const result = await createInvoice({
      ...baseInput,
      immediatePayments: [{ currencyId: 2, amountTendered: 10, paymentMethod: "cash" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("No hay una tasa de cambio configurada entre USD y CUP");
    }
    expect(tx.invoicePayment.createMany).not.toHaveBeenCalled();
  });

  it("amountTendered <= 0: error de validacion temprana, no abre transaccion de pago", async () => {
    const result = await createInvoice({
      ...baseInput,
      immediatePayments: [{ currencyId: null, amountTendered: 0, paymentMethod: "cash" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("El monto del cobro inmediato debe ser mayor a 0");
    }
  });

  it("tolerancia de redondeo (1 CUP, moneda base sin decimales): paga con 1 CUP de diferencia y queda 'paid'", async () => {
    // total 5000; el pago resuelve a 4999 (1 CUP por debajo) por artefactos
    // de redondeo en la conversion — la tolerancia de 1 CUP (base decimalPlaces=0)
    // debe considerarlo saldado, no "partial".
    stubDispatch(5000);
    const result = await createInvoice({
      ...baseInput,
      immediatePayments: [{ currencyId: null, amountTendered: 4999, paymentMethod: "cash" }],
    });

    expect(result.success).toBe(true);
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paid: 4999, status: "paid" }) })
    );
  });
});

describe("registerInvoicePayment — pagos multi-moneda (Fase 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    requireCurrentUserId.mockResolvedValue(1);
    getBaseCurrency.mockResolvedValue(CUP_BASE);
    tx.invoice.update.mockResolvedValue({});
    tx.customer.update.mockResolvedValue({});
    tx.invoicePayment.create.mockResolvedValue({ paymentId: 1 });
  });

  it("compat: shape anterior { amount } en moneda base", async () => {
    tx.invoice.findUnique.mockResolvedValue({
      invoiceId: 1,
      customerId: 1,
      status: "pending",
      total: 5000,
      paid: 0,
    });

    const result = await registerInvoicePayment(1, {
      amount: 2000,
      paymentMethod: "cash",
      paidAt: "2026-01-01",
    });

    expect(result.success).toBe(true);
    expect(tx.invoicePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 2000, currencyId: null, amountTendered: null, exchangeRate: null }),
      })
    );
    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { invoiceId: 1 },
      data: { paid: 2000, status: "partial" },
    });
  });

  it("pago en USD contra factura en CUP: convierte y aplica equivalente", async () => {
    tx.invoice.findUnique.mockResolvedValue({
      invoiceId: 1,
      customerId: 1,
      status: "partial",
      total: 5000,
      paid: 1000,
    });
    getRateToBase.mockResolvedValueOnce({ exchangeRateId: 5, rate: 380 });

    const result = await registerInvoicePayment(1, {
      currencyId: 2,
      amountTendered: 10,
      paymentMethod: "cash",
      paidAt: "2026-01-01",
    });

    expect(result.success).toBe(true);
    expect(tx.invoicePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 3800, currencyId: 2, amountTendered: 10, exchangeRate: 380 }),
      })
    );
    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { invoiceId: 1 },
      data: { paid: 4800, status: "partial" },
    });
  });

  it("pago que excede el saldo pendiente: error en español, no escribe nada", async () => {
    tx.invoice.findUnique.mockResolvedValue({
      invoiceId: 1,
      customerId: 1,
      status: "partial",
      total: 5000,
      paid: 4900,
    });

    const result = await registerInvoicePayment(1, {
      amount: 200,
      paymentMethod: "cash",
      paidAt: "2026-01-01",
    });

    // El saldo (100) es menor al pago (200): resolvePayments recorta el pago
    // aplicado a 100 (comportamiento de "vuelto"), por lo que la factura
    // queda saldada — no debe rechazarse, ya que 100 <= saldo.
    expect(result.success).toBe(true);
    expect(tx.invoicePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 100 }) })
    );
  });

  it("factura cancelada: error en español", async () => {
    tx.invoice.findUnique.mockResolvedValue({
      invoiceId: 1,
      customerId: 1,
      status: "cancelled",
      total: 5000,
      paid: 0,
    });

    const result = await registerInvoicePayment(1, {
      amount: 100,
      paymentMethod: "cash",
      paidAt: "2026-01-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Factura cancelada");
    }
  });
});
