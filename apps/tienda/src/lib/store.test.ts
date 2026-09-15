import { describe, expect, it } from "vitest";
import {
  cartLines,
  initialState,
  reducer,
  type CartLine,
  type StoreState,
} from "@/lib/store";

function line(overrides: Partial<CartLine> & { sku: string }): CartLine {
  return {
    productSku: overrides.sku,
    name: "Camiseta básica · M",
    presentationName: null,
    unitPrice: 950,
    qty: 1,
    imageUrl: null,
    stockAvailable: 10,
    ...overrides,
  };
}

function add(state: StoreState, l: CartLine, qty = 1): StoreState {
  return reducer(state, { type: "addToCart", line: l, qty });
}

describe("carrito con modelos y formatos", () => {
  it("dos modelos del mismo grupo son dos líneas", () => {
    let state = add(initialState, line({ sku: "CAM-M", modelLabel: "M" }));
    state = add(state, line({ sku: "CAM-L", modelLabel: "L", unitPrice: 990 }));
    const lines = cartLines(state);
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.sku)).toEqual(["CAM-M", "CAM-L"]);
    expect(lines.map((l) => l.modelLabel)).toEqual(["M", "L"]);
  });

  it("el mismo modelo en dos formatos son dos líneas; repetir formato suma qty", () => {
    let state = add(initialState, line({ sku: "CAM-M", modelLabel: "M" }));
    state = add(
      state,
      line({
        sku: "CAM-M-CAJA",
        productSku: "CAM-M",
        modelLabel: "M",
        presentationName: "Caja 12",
        unitPrice: 10800,
      })
    );
    state = add(state, line({ sku: "CAM-M", modelLabel: "M" }), 2);
    const lines = cartLines(state);
    expect(lines).toHaveLength(2);
    expect(state.cart["CAM-M"].qty).toBe(3);
    expect(state.cart["CAM-M-CAJA"].qty).toBe(1);
    expect(state.cart["CAM-M-CAJA"].presentationName).toBe("Caja 12");
  });

  it("una línea estimada reemplaza a la línea con piezas del mismo sku (por eso la card delega la elección de pieza al detalle)", () => {
    let state = add(
      initialState,
      line({
        sku: "QUESO-PZA",
        productSku: "QUESO-1",
        presentationName: "Pieza",
        isCatchWeight: true,
        pieces: [
          { pieceId: 501, weightKg: 1.2, price: 1080 },
          { pieceId: 502, weightKg: 1.1, price: 990 },
        ],
      }),
      2
    );
    expect(state.cart["QUESO-PZA"].qty).toBe(2);
    state = add(
      state,
      line({ sku: "QUESO-PZA", productSku: "QUESO-1", presentationName: "Pieza", isCatchWeight: true })
    );
    expect(state.cart["QUESO-PZA"].pieces).toBeUndefined();
    expect(state.cart["QUESO-PZA"].qty).toBe(1);
  });

  it("líneas viejas sin modelLabel siguen siendo válidas y se fusionan por sku", () => {
    const legacy: CartLine = {
      sku: "SAL-1",
      productSku: "SAL-1",
      name: "Sal fina",
      presentationName: null,
      unitPrice: 50,
      qty: 2,
      imageUrl: null,
      stockAvailable: 9,
    };
    let state = reducer(initialState, {
      type: "hydrate",
      payload: { cart: { "SAL-1": legacy } },
    });
    expect(state.hydrated).toBe(true);
    state = add(state, line({ sku: "SAL-1", name: "Sal fina", unitPrice: 50 }));
    expect(cartLines(state)).toHaveLength(1);
    expect(state.cart["SAL-1"].qty).toBe(3);
    expect(state.cart["SAL-1"].modelLabel).toBeUndefined();
    state = reducer(state, { type: "decQty", sku: "SAL-1" });
    expect(state.cart["SAL-1"].qty).toBe(2);
  });
});
