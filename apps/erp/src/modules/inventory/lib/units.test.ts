import { describe, it, expect } from "vitest";
import { toBaseQuantity, formatEquivalence } from "./units";

describe("toBaseQuantity", () => {
  it("convierte presentación entera a unidades base", () => {
    expect(toBaseQuantity(2, 24)).toBe(48);
    expect(toBaseQuantity(1, 24)).toBe(24);
  });

  it("factor 1 (presentación base) devuelve la misma cantidad", () => {
    expect(toBaseQuantity(5, 1)).toBe(5);
  });

  it("soporta factores decimales (ej. saco de 25.5 kg)", () => {
    expect(toBaseQuantity(2, 25.5)).toBe(51);
    expect(toBaseQuantity(3, 25.5)).toBe(76.5);
  });

  it("elimina residuos de punto flotante", () => {
    // 3 × 0.1 = 0.30000000000000004 en IEEE 754.
    expect(toBaseQuantity(3, 0.1)).toBe(0.3);
    expect(toBaseQuantity(6, 0.7)).toBe(4.2);
  });
});

describe("formatEquivalence", () => {
  it("muestra la equivalencia cuando el factor no es 1", () => {
    expect(formatEquivalence(2, 24, "Caja 24", "lata")).toBe("2 Caja 24 = 48 lata");
  });

  it("con factor 1 solo muestra la cantidad en unidad base", () => {
    expect(formatEquivalence(5, 1, "lata", "lata")).toBe("5 lata");
  });

  it("soporta factores decimales", () => {
    expect(formatEquivalence(2, 25.5, "Saco 25.5kg", "kg")).toBe("2 Saco 25.5kg = 51 kg");
  });
});
