import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/module-registry", () => ({
  getEnabledModuleIds: () => ["inventory", "sales", "entregas"],
}));

import { mergeEffectiveModules, sanitizeModuleIds } from "./effective-modules";

describe("mergeEffectiveModules", () => {
  it("une los módulos propios con los del rol sin duplicar", () => {
    expect(mergeEffectiveModules(["sales", "inventory"], ["inventory", "entregas"]))
      .toEqual(["sales", "inventory", "entregas"]);
  });

  it("devuelve vacío cuando ninguna fuente concede módulos", () => {
    expect(mergeEffectiveModules([], [])).toEqual([]);
  });
});

describe("sanitizeModuleIds", () => {
  it("descarta ids que no están habilitados en el registry", () => {
    expect(sanitizeModuleIds(["sales", "payments", "hacker"])).toEqual(["sales"]);
  });

  it("elimina duplicados", () => {
    expect(sanitizeModuleIds(["sales", "sales", "entregas"])).toEqual([
      "sales",
      "entregas",
    ]);
  });
});
