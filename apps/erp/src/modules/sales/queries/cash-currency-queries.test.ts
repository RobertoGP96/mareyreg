import { describe, it, expect, vi, beforeEach } from "vitest";

const { db, getBaseCurrency } = vi.hoisted(() => {
  const db = {
    invoicePayment: {
      findMany: vi.fn(),
    },
  };
  return {
    db,
    getBaseCurrency: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/currency", () => ({ getBaseCurrency }));

import { getCashSessionCurrencyBreakdown } from "./cash-currency-queries";

const BASE = { currencyId: 1, code: "CUP", symbol: "$", decimalPlaces: 0 };

describe("getCashSessionCurrencyBreakdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBaseCurrency.mockResolvedValue(BASE);
  });

  it("agrupa pagos mixtos CUP + USD correctamente", async () => {
    db.invoicePayment.findMany.mockResolvedValue([
      // Pago en CUP (currencyId null): amountTendered null, amount = lo aplicado.
      { amount: 500, currencyId: null, amountTendered: null, currency: null },
      { amount: 300, currencyId: null, amountTendered: null, currency: null },
      // Dos pagos en USD con tasa 26.
      {
        amount: 2600,
        currencyId: 2,
        amountTendered: 100,
        currency: { code: "USD", symbol: "US$", decimalPlaces: 2 },
      },
      {
        amount: 1300,
        currencyId: 2,
        amountTendered: 50,
        currency: { code: "USD", symbol: "US$", decimalPlaces: 2 },
      },
    ]);

    const result = await getCashSessionCurrencyBreakdown(1);

    expect(db.invoicePayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { invoice: { sessionId: 1 } } })
    );

    expect(result).toHaveLength(2);

    const cupRow = result.find((r) => r.currencyId === null);
    expect(cupRow).toMatchObject({
      currencyCode: "CUP",
      totalTendered: 800,
      totalAppliedBase: 800,
      paymentsCount: 2,
    });

    const usdRow = result.find((r) => r.currencyId === 2);
    expect(usdRow).toMatchObject({
      currencyCode: "USD",
      totalTendered: 150,
      totalAppliedBase: 3900,
      paymentsCount: 2,
    });

    // La moneda base siempre va primero.
    expect(result[0].currencyId).toBeNull();
  });

  it("retorna solo la fila CUP en 0 cuando la sesión no tiene pagos", async () => {
    db.invoicePayment.findMany.mockResolvedValue([]);

    const result = await getCashSessionCurrencyBreakdown(42);

    expect(result).toEqual([
      {
        currencyId: null,
        currencyCode: "CUP",
        symbol: "$",
        decimalPlaces: 0,
        totalTendered: 0,
        totalAppliedBase: 0,
        paymentsCount: 0,
      },
    ]);
  });
});
