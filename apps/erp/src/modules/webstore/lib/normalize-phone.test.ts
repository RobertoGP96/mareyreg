import { describe, it, expect } from "vitest";
import { normalizePhone } from "./normalize-phone";

describe("normalizePhone", () => {
  it("extrae solo dígitos de un teléfono con formato", () => {
    expect(normalizePhone("+52 (55) 1234-5678")).toBe("525512345678");
  });

  it("devuelve solo dígitos sin formato adicional", () => {
    expect(normalizePhone("555-123-4567")).toBe("5551234567");
  });

  it("devuelve null si hay menos de 5 dígitos", () => {
    expect(normalizePhone("1234")).toBeNull();
  });

  it("devuelve null para string vacío", () => {
    expect(normalizePhone("")).toBeNull();
  });

  it("devuelve null para null", () => {
    expect(normalizePhone(null)).toBeNull();
  });

  it("devuelve null para undefined", () => {
    expect(normalizePhone(undefined)).toBeNull();
  });

  it("acepta exactamente 5 dígitos", () => {
    expect(normalizePhone("12345")).toBe("12345");
  });

  it("ignora letras y símbolos mezclados con dígitos", () => {
    expect(normalizePhone("tel: 55-1234 ext.99")).toBe("55123499");
  });
});
