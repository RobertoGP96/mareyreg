import { describe, it, expect } from "vitest";
import {
  toBaseQuantity,
  formatEquivalence,
  piecesFor,
  catchWeightBaseQuantity,
  formatCatchWeight,
} from "./units";

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

describe("piecesFor", () => {
  it("calcula piezas totales para cantidad y piecesPerUnit válidos", () => {
    expect(piecesFor(2, 5)).toBe(10);
    expect(piecesFor(1, 1)).toBe(1);
  });

  it("rechaza quantity fraccional", () => {
    expect(() => piecesFor(1.5, 5)).toThrow("entero mayor o igual a 1");
  });

  it("rechaza quantity cero o negativa", () => {
    expect(() => piecesFor(0, 5)).toThrow("entero mayor o igual a 1");
    expect(() => piecesFor(-1, 5)).toThrow("entero mayor o igual a 1");
  });

  it("rechaza piecesPerUnit fraccional, cero o negativo", () => {
    expect(() => piecesFor(1, 2.5)).toThrow("piezas por unidad");
    expect(() => piecesFor(1, 0)).toThrow("piezas por unidad");
    expect(() => piecesFor(1, -3)).toThrow("piezas por unidad");
  });
});

describe("catchWeightBaseQuantity", () => {
  it("redondea a 8 decimales igual que toBaseQuantity", () => {
    expect(catchWeightBaseQuantity(17.123456789)).toBe(17.12345679);
  });

  it("acepta pesos válidos sin alterar el valor cuando ya tiene <=8 decimales", () => {
    expect(catchWeightBaseQuantity(17.35)).toBe(17.35);
  });

  it("rechaza 0, negativos y NaN", () => {
    expect(() => catchWeightBaseQuantity(0)).toThrow("finito mayor a 0");
    expect(() => catchWeightBaseQuantity(-5)).toThrow("finito mayor a 0");
    expect(() => catchWeightBaseQuantity(NaN)).toThrow("finito mayor a 0");
  });

  it("rechaza infinito", () => {
    expect(() => catchWeightBaseQuantity(Infinity)).toThrow("finito mayor a 0");
  });
});

describe("formatCatchWeight", () => {
  it("caja con varias piezas muestra el paréntesis de piezas", () => {
    expect(formatCatchWeight(1, "Caja", 5, 17.35)).toBe("1 Caja (5 pzas) · 17.35 kg");
  });

  it("pieza (piecesPerUnit 1) omite el paréntesis", () => {
    expect(formatCatchWeight(2, "Pieza", 2, 6.8)).toBe("2 Pieza · 6.8 kg");
  });

  it("redondea el peso a 3 decimales sin ceros de más", () => {
    expect(formatCatchWeight(1, "Caja", 3, 12.34999)).toBe("1 Caja (3 pzas) · 12.35 kg");
    expect(formatCatchWeight(1, "Pieza", 1, 5)).toBe("1 Pieza · 5 kg");
  });
});
