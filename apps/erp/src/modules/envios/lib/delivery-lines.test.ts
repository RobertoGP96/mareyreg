import { describe, it, expect } from "vitest";
import {
  scaledEquals,
  scaleToCurrency,
  describeDeliveryDbError,
  resolveDeliveryLines,
} from "./delivery-lines";

// Decimal de Prisma solo necesita `toNumber()` para lo que usa el helper.
const dec = (n: number) => ({ toNumber: () => n });

type FakeCatalog = {
  currencies: {
    currencyId: number;
    code: string;
    kind: "cash" | "digital";
    active: boolean;
    decimalPlaces: number;
  }[];
  denominations: {
    denominationId: number;
    currencyId: number;
    value: number;
    active: boolean;
  }[];
};

function fakeTx(catalog: FakeCatalog) {
  return {
    currency: {
      findMany: async ({ where }: { where: { currencyId: { in: number[] } } }) =>
        catalog.currencies.filter((c) => where.currencyId.in.includes(c.currencyId)),
    },
    currencyDenomination: {
      findMany: async ({ where }: { where: { denominationId: { in: number[] } } }) =>
        catalog.denominations
          .filter((d) => where.denominationId.in.includes(d.denominationId))
          .map((d) => ({ ...d, value: dec(d.value) })),
    },
  } as unknown as Parameters<typeof resolveDeliveryLines>[0];
}

const CUP = { currencyId: 1, code: "CUP", kind: "cash", active: true, decimalPlaces: 0 } as const;
const USD = { currencyId: 2, code: "USD", kind: "cash", active: true, decimalPlaces: 2 } as const;
const USDT = {
  currencyId: 3, code: "USDT", kind: "digital", active: true, decimalPlaces: 2,
} as const;

const CATALOG: FakeCatalog = {
  currencies: [CUP, USD, USDT],
  denominations: [
    { denominationId: 10, currencyId: 1, value: 1000, active: true },
    { denominationId: 11, currencyId: 1, value: 500, active: true },
    { denominationId: 12, currencyId: 1, value: 1, active: true },
    { denominationId: 13, currencyId: 1, value: 200, active: false },
    { denominationId: 20, currencyId: 2, value: 100, active: true },
    { denominationId: 21, currencyId: 2, value: 0.1, active: true },
  ],
};

describe("scaledEquals", () => {
  it("compara con los decimales de la moneda", () => {
    expect(scaledEquals(1250, 1250, 0)).toBe(true);
    expect(scaledEquals(1250, 1251, 0)).toBe(false);
  });

  it("ignora residuos binarios por debajo de la precisión de la moneda", () => {
    // 0.1 + 0.2 = 0.30000000000000004 en IEEE 754.
    expect(scaledEquals(0.1 + 0.2, 0.3, 2)).toBe(true);
  });

  it("CUP (0 decimales) trata los centavos como diferencia", () => {
    expect(scaledEquals(100.4, 100, 0)).toBe(true);
    expect(scaledEquals(100.6, 100, 0)).toBe(false);
  });
});

describe("scaleToCurrency", () => {
  it("redondea al número de decimales de la moneda", () => {
    expect(scaleToCurrency(1234.567, 2)).toBe(1234.57);
    expect(scaleToCurrency(1234.567, 0)).toBe(1235);
  });

  it("aplica half-up estable", () => {
    expect(scaleToCurrency(1.005, 2)).toBe(1.01);
  });
});

describe("describeDeliveryDbError", () => {
  it("traduce los errores de los triggers a español", () => {
    expect(describeDeliveryDbError(new Error("err_delivery_breakdown_mismatch"), "x")).toContain(
      "no cuadra"
    );
    expect(
      describeDeliveryDbError(new Error("...err_delivery_without_lines..."), "x")
    ).toContain("al menos un monto");
  });

  it("usa el fallback cuando el error no es conocido", () => {
    expect(describeDeliveryDbError(new Error("boom"), "fallback")).toBe("fallback");
  });
});

describe("resolveDeliveryLines", () => {
  it("deriva el monto de la línea del desglose", async () => {
    const [line] = await resolveDeliveryLines(fakeTx(CATALOG), [
      {
        currencyId: 1,
        denominations: [
          { denominationId: 10, quantity: 1 },
          { denominationId: 11, quantity: 2 },
          { denominationId: 12, quantity: 50 },
        ],
      },
    ]);
    expect(line.amount).toBe(2050);
    expect(line.denominations).toHaveLength(3);
  });

  it("snapshotea el valor del catálogo, no del cliente", async () => {
    const [line] = await resolveDeliveryLines(fakeTx(CATALOG), [
      { currencyId: 2, denominations: [{ denominationId: 20, quantity: 2 }] },
    ]);
    expect(line.denominations[0].unitValue).toBe(100);
    expect(line.amount).toBe(200);
  });

  it("redondea con los decimales de la moneda de la línea", async () => {
    // 3 × 0.1 = 0.30000000000000004 sin redondeo.
    const [line] = await resolveDeliveryLines(fakeTx(CATALOG), [
      { currencyId: 2, denominations: [{ denominationId: 21, quantity: 3 }] },
    ]);
    expect(line.amount).toBe(0.3);
  });

  it("resuelve varias monedas en una entrega", async () => {
    const lines = await resolveDeliveryLines(fakeTx(CATALOG), [
      { currencyId: 2, denominations: [{ denominationId: 20, quantity: 2 }] },
      { currencyId: 1, denominations: [{ denominationId: 10, quantity: 5 }] },
    ]);
    expect(lines.map((l) => l.amount)).toEqual([200, 5000]);
  });

  it("rechaza una denominación de otra moneda", async () => {
    await expect(
      resolveDeliveryLines(fakeTx(CATALOG), [
        { currencyId: 1, denominations: [{ denominationId: 20, quantity: 1 }] },
      ])
    ).rejects.toThrow(/no pertenece a CUP/);
  });

  it("rechaza una denominación desactivada", async () => {
    await expect(
      resolveDeliveryLines(fakeTx(CATALOG), [
        { currencyId: 1, denominations: [{ denominationId: 13, quantity: 1 }] },
      ])
    ).rejects.toThrow(/desactivada/);
  });

  it("rechaza una denominación inexistente", async () => {
    await expect(
      resolveDeliveryLines(fakeTx(CATALOG), [
        { currencyId: 1, denominations: [{ denominationId: 999, quantity: 1 }] },
      ])
    ).rejects.toThrow(/inexistente/);
  });

  it("rechaza una moneda desactivada", async () => {
    const catalog: FakeCatalog = {
      ...CATALOG,
      currencies: [{ ...CUP, active: false }, USD, USDT],
    };
    await expect(
      resolveDeliveryLines(fakeTx(catalog), [
        { currencyId: 1, denominations: [{ denominationId: 10, quantity: 1 }] },
      ])
    ).rejects.toThrow(/desactivada/);
  });

  it("exige desglose en moneda de efectivo", async () => {
    await expect(
      resolveDeliveryLines(fakeTx(CATALOG), [{ currencyId: 1, denominations: [] }])
    ).rejects.toThrow(/Captura el desglose/);
  });
});

describe("resolveDeliveryLines · monedas digitales", () => {
  it("toma el monto capturado directo, sin desglose", async () => {
    const [line] = await resolveDeliveryLines(fakeTx(CATALOG), [
      { currencyId: 3, amount: 150.5, denominations: [] },
    ]);
    expect(line.amount).toBe(150.5);
    expect(line.denominations).toEqual([]);
  });

  it("redondea a los decimales de la moneda", async () => {
    const [line] = await resolveDeliveryLines(fakeTx(CATALOG), [
      { currencyId: 3, amount: 10.567, denominations: [] },
    ]);
    expect(line.amount).toBe(10.57);
  });

  it("rechaza monto ausente o no positivo", async () => {
    await expect(
      resolveDeliveryLines(fakeTx(CATALOG), [{ currencyId: 3, denominations: [] }])
    ).rejects.toThrow(/mayor a 0/);
    await expect(
      resolveDeliveryLines(fakeTx(CATALOG), [
        { currencyId: 3, amount: 0, denominations: [] },
      ])
    ).rejects.toThrow(/mayor a 0/);
  });

  it("rechaza desglose de billetes en moneda digital", async () => {
    await expect(
      resolveDeliveryLines(fakeTx(CATALOG), [
        { currencyId: 3, amount: 10, denominations: [{ denominationId: 20, quantity: 1 }] },
      ])
    ).rejects.toThrow(/digital y no admite desglose/);
  });

  it("mezcla efectivo y digital en la misma entrega", async () => {
    const lines = await resolveDeliveryLines(fakeTx(CATALOG), [
      { currencyId: 1, denominations: [{ denominationId: 10, quantity: 2 }] },
      { currencyId: 3, amount: 75, denominations: [] },
    ]);
    expect(lines.map((l) => l.amount)).toEqual([2000, 75]);
  });
});
