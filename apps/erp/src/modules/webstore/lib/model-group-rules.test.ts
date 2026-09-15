import { describe, it, expect } from "vitest";
import { modelGroupMembershipIssue, type ModelGroupMemberFacts } from "./model-group-rules";

function facts(overrides: Partial<ModelGroupMemberFacts> = {}): ModelGroupMemberFacts {
  return {
    productId: 1,
    name: "Camiseta básica M",
    sku: "CAM-BAS-M",
    unit: "pieza",
    isCatchWeight: false,
    isService: false,
    modelGroupId: null,
    ...overrides,
  };
}

describe("modelGroupMembershipIssue", () => {
  it("acepta un candidato suelto con SKU en un grupo vacío", () => {
    expect(modelGroupMembershipIssue([], facts())).toBeNull();
  });

  it("rechaza servicios", () => {
    expect(modelGroupMembershipIssue([], facts({ isService: true }))).toMatch(/servicio/);
  });

  it("rechaza productos sin SKU (null o en blanco)", () => {
    expect(modelGroupMembershipIssue([], facts({ sku: null }))).toMatch(/SKU/);
    expect(modelGroupMembershipIssue([], facts({ sku: "   " }))).toMatch(/SKU/);
  });

  it("rechaza un producto que ya está en OTRO grupo", () => {
    expect(modelGroupMembershipIssue([], facts({ modelGroupId: 9 }), 7)).toMatch(/otro grupo/);
    expect(modelGroupMembershipIssue([], facts({ modelGroupId: 9 }), null)).toMatch(/otro grupo/);
  });

  it("acepta un producto que ya está en el MISMO grupo", () => {
    expect(modelGroupMembershipIssue([], facts({ modelGroupId: 7 }), 7)).toBeNull();
  });

  it("exige que todos compartan isCatchWeight", () => {
    const reference = facts({ productId: 2, unit: "kg", isCatchWeight: true });
    expect(
      modelGroupMembershipIssue([reference], facts({ productId: 1, unit: "kg", isCatchWeight: false }))
    ).toMatch(/peso variable/);
    expect(
      modelGroupMembershipIssue([facts({ productId: 2 })], facts({ productId: 1, unit: "kg", isCatchWeight: true }))
    ).toMatch(/peso variable/);
  });

  it("exige que todos compartan unit", () => {
    const issue = modelGroupMembershipIssue([facts({ productId: 2, unit: "pieza" })], facts({ productId: 1, unit: "caja" }));
    expect(issue).toMatch(/unidad/);
    expect(issue).toContain("«caja»");
    expect(issue).toContain("«pieza»");
  });

  it("ignora al propio candidato dentro de members al buscar referencia", () => {
    const self = facts({ productId: 1, unit: "caja" });
    expect(modelGroupMembershipIssue([self], self)).toBeNull();
  });

  it("acepta candidatos compatibles (misma unit, mismo isCatchWeight)", () => {
    const members = [facts({ productId: 2, sku: "CAM-BAS-L", name: "Camiseta básica L" })];
    expect(modelGroupMembershipIssue(members, facts({ productId: 1 }))).toBeNull();
  });
});
