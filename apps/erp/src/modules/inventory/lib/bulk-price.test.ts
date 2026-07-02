import { describe, it, expect } from "vitest";
import {
  buildPriceExpression,
  buildScopeCondition,
  bulkPriceAdjustmentSchema,
} from "./bulk-price";

describe("buildPriceExpression", () => {
  it("percent + increase + none", () => {
    expect(
      buildPriceExpression("retail_price", {
        mode: "percent",
        direction: "increase",
        value: 10,
        rounding: "none",
      })
    ).toBe("GREATEST(retail_price * (1 + 10/100), 0)");
  });

  it("percent + increase + cents", () => {
    expect(
      buildPriceExpression("retail_price", {
        mode: "percent",
        direction: "increase",
        value: 10,
        rounding: "cents",
      })
    ).toBe("GREATEST(ROUND((retail_price * (1 + 10/100))::numeric, 2), 0)");
  });

  it("percent + decrease + whole", () => {
    expect(
      buildPriceExpression("wholesale_price", {
        mode: "percent",
        direction: "decrease",
        value: 15,
        rounding: "whole",
      })
    ).toBe("GREATEST(ROUND((wholesale_price * (1 - 15/100))::numeric), 0)");
  });

  it("percent + decrease + fifty", () => {
    expect(
      buildPriceExpression("retail_price", {
        mode: "percent",
        direction: "decrease",
        value: 20,
        rounding: "fifty",
      })
    ).toBe("GREATEST(ROUND((retail_price * (1 - 20/100))::numeric * 2) / 2.0, 0)");
  });

  it("fixed + increase + none", () => {
    expect(
      buildPriceExpression("retail_price", {
        mode: "fixed",
        direction: "increase",
        value: 5,
        rounding: "none",
      })
    ).toBe("GREATEST(retail_price + 5, 0)");
  });

  it("fixed + increase + cents", () => {
    expect(
      buildPriceExpression("wholesale_price", {
        mode: "fixed",
        direction: "increase",
        value: 2.5,
        rounding: "cents",
      })
    ).toBe("GREATEST(ROUND((wholesale_price + 2.5)::numeric, 2), 0)");
  });

  it("fixed + decrease + whole", () => {
    expect(
      buildPriceExpression("retail_price", {
        mode: "fixed",
        direction: "decrease",
        value: 3,
        rounding: "whole",
      })
    ).toBe("GREATEST(ROUND((retail_price - 3)::numeric), 0)");
  });

  it("fixed + decrease + fifty", () => {
    expect(
      buildPriceExpression("retail_price", {
        mode: "fixed",
        direction: "decrease",
        value: 3,
        rounding: "fifty",
      })
    ).toBe("GREATEST(ROUND((retail_price - 3)::numeric * 2) / 2.0, 0)");
  });

  it("siempre envuelve el resultado en GREATEST(", () => {
    const combos = [
      { mode: "percent", direction: "increase", rounding: "none" },
      { mode: "percent", direction: "decrease", rounding: "cents" },
      { mode: "fixed", direction: "increase", rounding: "fifty" },
      { mode: "fixed", direction: "decrease", rounding: "whole" },
    ] as const;
    for (const combo of combos) {
      const result = buildPriceExpression("retail_price", { ...combo, value: 7 });
      expect(result).toContain("GREATEST(");
    }
  });

  it("lanza error si value no es finito (defensa en profundidad)", () => {
    expect(() =>
      buildPriceExpression("retail_price", {
        mode: "percent",
        direction: "increase",
        value: Infinity,
        rounding: "none",
      })
    ).toThrow();
    expect(() =>
      buildPriceExpression("retail_price", {
        mode: "percent",
        direction: "increase",
        value: NaN,
        rounding: "none",
      })
    ).toThrow();
  });
});

describe("bulkPriceAdjustmentSchema", () => {
  const base = {
    scope: { kind: "all" as const },
    mode: "percent" as const,
    direction: "increase" as const,
    target: "retail" as const,
    rounding: "none" as const,
  };

  it("acepta un input válido mínimo", () => {
    const result = bulkPriceAdjustmentSchema.safeParse({ ...base, value: 10 });
    expect(result.success).toBe(true);
  });

  it("rechaza value <= 0", () => {
    expect(bulkPriceAdjustmentSchema.safeParse({ ...base, value: 0 }).success).toBe(false);
    expect(bulkPriceAdjustmentSchema.safeParse({ ...base, value: -5 }).success).toBe(false);
  });

  it("rechaza value no finito", () => {
    expect(bulkPriceAdjustmentSchema.safeParse({ ...base, value: Infinity }).success).toBe(false);
    expect(bulkPriceAdjustmentSchema.safeParse({ ...base, value: NaN }).success).toBe(false);
  });

  it("rechaza percent + decrease con value > 100", () => {
    const result = bulkPriceAdjustmentSchema.safeParse({
      ...base,
      direction: "decrease",
      value: 101,
    });
    expect(result.success).toBe(false);
  });

  it("acepta percent + decrease con value = 100", () => {
    const result = bulkPriceAdjustmentSchema.safeParse({
      ...base,
      direction: "decrease",
      value: 100,
    });
    expect(result.success).toBe(true);
  });

  it("acepta percent + increase con value > 100 (sin tope)", () => {
    const result = bulkPriceAdjustmentSchema.safeParse({
      ...base,
      direction: "increase",
      value: 500,
    });
    expect(result.success).toBe(true);
  });

  it("acepta fixed + decrease con value grande (el tope de 100 es solo para percent)", () => {
    const result = bulkPriceAdjustmentSchema.safeParse({
      ...base,
      mode: "fixed",
      direction: "decrease",
      value: 500,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza scope kind:products con array vacío", () => {
    const result = bulkPriceAdjustmentSchema.safeParse({
      ...base,
      scope: { kind: "products", productIds: [] },
      value: 10,
    });
    expect(result.success).toBe(false);
  });

  it("acepta scope kind:products con al menos un id", () => {
    const result = bulkPriceAdjustmentSchema.safeParse({
      ...base,
      scope: { kind: "products", productIds: [1, 2, 3] },
      value: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza scope kind:category con category vacía", () => {
    const result = bulkPriceAdjustmentSchema.safeParse({
      ...base,
      scope: { kind: "category", category: "" },
      value: 10,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza reason de más de 200 caracteres", () => {
    const result = bulkPriceAdjustmentSchema.safeParse({
      ...base,
      value: 10,
      reason: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("acepta reason de exactamente 200 caracteres", () => {
    const result = bulkPriceAdjustmentSchema.safeParse({
      ...base,
      value: 10,
      reason: "a".repeat(200),
    });
    expect(result.success).toBe(true);
  });
});

describe("buildScopeCondition", () => {
  it("scope 'all' devuelve condición siempre verdadera sin params", () => {
    const result = buildScopeCondition({ kind: "all" });
    expect(result.sql).toBe("TRUE");
    expect(result.params).toEqual([]);
  });

  it("scope 'category' parametriza el valor de categoría", () => {
    const result = buildScopeCondition({ kind: "category", category: "Bebidas" });
    expect(result.sql).toBe("p.category = $1");
    expect(result.params).toEqual(["Bebidas"]);
  });

  it("scope 'products' con un solo id genera un placeholder", () => {
    const result = buildScopeCondition({ kind: "products", productIds: [42] });
    expect(result.sql).toBe("pp.product_id IN ($1)");
    expect(result.params).toEqual([42]);
  });

  it("scope 'products' con varios ids genera placeholders secuenciales", () => {
    const result = buildScopeCondition({ kind: "products", productIds: [1, 2, 3] });
    expect(result.sql).toBe("pp.product_id IN ($1, $2, $3)");
    expect(result.params).toEqual([1, 2, 3]);
  });
});
