import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma";

const { db } = vi.hoisted(() => {
  const db = {
    company: {
      findUnique: vi.fn(),
    },
    exchangeRate: {
      findUnique: vi.fn(),
    },
    currency: {
      findUnique: vi.fn(),
    },
  };
  return { db };
});

vi.mock("@/lib/db", () => ({ db }));

import {
  getBaseCurrency,
  getRateToBase,
  convertToBase,
  roundToCurrency,
  GlobalRateNotConfiguredError,
} from "./currency";

function decimalLike(value: number) {
  return new Prisma.Decimal(value);
}

const CUP_BASE = {
  id: 1,
  baseCurrencyId: 1,
  baseCurrency: { currencyId: 1, code: "CUP", symbol: "$", decimalPlaces: 0 },
};

describe("currency helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBaseCurrency", () => {
    it("devuelve la moneda base configurada en Company", async () => {
      db.company.findUnique.mockResolvedValue(CUP_BASE);

      const result = await getBaseCurrency(db as never);

      expect(result).toEqual({ currencyId: 1, code: "CUP", symbol: "$", decimalPlaces: 0 });
    });

    it("lanza error si la empresa no tiene moneda base configurada", async () => {
      db.company.findUnique.mockResolvedValue({ id: 1, baseCurrencyId: null, baseCurrency: null });

      await expect(getBaseCurrency(db as never)).rejects.toThrow(
        "La empresa no tiene moneda base configurada. Ejecuta el backfill de monedas."
      );
    });
  });

  describe("getRateToBase", () => {
    it("identidad cuando fromCurrencyId es la moneda base", async () => {
      db.company.findUnique.mockResolvedValue(CUP_BASE);

      const result = await getRateToBase(db as never, 1);

      expect(result).toEqual({ exchangeRateId: null, rate: 1 });
      expect(db.exchangeRate.findUnique).not.toHaveBeenCalled();
    });

    it("par directo (from=base de la fila, quote=moneda base de la empresa) usa rate tal cual", async () => {
      db.company.findUnique.mockResolvedValue(CUP_BASE);
      db.exchangeRate.findUnique.mockResolvedValueOnce({
        exchangeRateId: 5,
        rate: decimalLike(380),
      });

      const result = await getRateToBase(db as never, 2); // USD -> CUP

      expect(result).toEqual({ exchangeRateId: 5, rate: 380 });
      expect(db.exchangeRate.findUnique).toHaveBeenCalledWith({
        where: { baseCurrencyId_quoteCurrencyId: { baseCurrencyId: 2, quoteCurrencyId: 1 } },
      });
    });

    it("par inverso (base=moneda base de la empresa, quote=from) usa 1/rate", async () => {
      db.company.findUnique.mockResolvedValue(CUP_BASE);
      db.exchangeRate.findUnique
        .mockResolvedValueOnce(null) // directo no existe
        .mockResolvedValueOnce({ exchangeRateId: 7, rate: decimalLike(380) }); // inverso

      const result = await getRateToBase(db as never, 2);

      expect(result).toEqual({ exchangeRateId: 7, rate: 1 / 380 });
    });

    it("sin ningún par configurado lanza GlobalRateNotConfiguredError", async () => {
      db.company.findUnique.mockResolvedValue(CUP_BASE);
      db.exchangeRate.findUnique.mockResolvedValue(null);
      db.currency.findUnique.mockResolvedValue({ currencyId: 2, code: "USD" });

      await expect(getRateToBase(db as never, 2)).rejects.toThrow(GlobalRateNotConfiguredError);
      await expect(getRateToBase(db as never, 2)).rejects.toThrow(
        "No hay una tasa de cambio configurada entre USD y CUP. Configúrala en Divisas antes de continuar."
      );
    });
  });

  describe("convertToBase", () => {
    it("convierte el monto usando la tasa resuelta", async () => {
      db.company.findUnique.mockResolvedValue(CUP_BASE);
      db.exchangeRate.findUnique.mockResolvedValueOnce({
        exchangeRateId: 5,
        rate: decimalLike(380),
      });

      const result = await convertToBase(db as never, 10, 2);

      expect(result).toEqual({ amountBase: 3800, rate: 380, exchangeRateId: 5 });
    });
  });

  describe("roundToCurrency", () => {
    it("redondea a 0 decimales (CUP)", () => {
      expect(roundToCurrency(2.5, 0)).toBe(3);
      expect(roundToCurrency(2.4, 0)).toBe(2);
    });

    it("redondea a 2 decimales (USD) sin artefactos binarios", () => {
      expect(roundToCurrency(1.005, 2)).toBe(1.01);
      expect(roundToCurrency(10.145, 2)).toBe(10.15);
    });

    it("maneja montos grandes correctamente", () => {
      expect(roundToCurrency(1234567.895, 2)).toBe(1234567.9);
      expect(roundToCurrency(999999.5, 0)).toBe(1000000);
    });
  });
});
