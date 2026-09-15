import { describe, it, expect, vi, beforeEach } from "vitest";

const { tx } = vi.hoisted(() => ({
  tx: {
    product: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import {
  syncModelGroupMembers,
  ModelGroupConflictError,
  type ModelGroupMemberSnapshot,
} from "./sync-model-group-members";

function product(overrides: Partial<ModelGroupMemberSnapshot> = {}): ModelGroupMemberSnapshot {
  return {
    productId: 1,
    name: "Camiseta básica M",
    sku: "CAM-BAS-M",
    unit: "pieza",
    isCatchWeight: false,
    isService: false,
    modelGroupId: null,
    modelLabel: null,
    modelSortOrder: 0,
    ...overrides,
  };
}

/** La primera findMany carga los miembros actuales del grupo, la segunda los candidatos. */
function arrange(current: ModelGroupMemberSnapshot[], candidates: ModelGroupMemberSnapshot[]) {
  tx.product.findMany.mockImplementation(async (args: { where: { modelGroupId?: number } }) =>
    args.where.modelGroupId !== undefined ? current : candidates
  );
}

const GROUP = 7;
const DETACHED = { modelGroupId: null, modelLabel: null, modelSortOrder: 0 };

describe("syncModelGroupMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.product.updateMany.mockResolvedValue({ count: 1 });
  });

  it("lanza ModelGroupConflictError si un producto no existe", async () => {
    arrange([], [product({ productId: 1 })]);

    await expect(
      syncModelGroupMembers(tx as never, GROUP, [
        { productId: 1, modelLabel: "M", modelSortOrder: 0 },
        { productId: 2, modelLabel: "L", modelSortOrder: 1 },
      ])
    ).rejects.toThrow(ModelGroupConflictError);
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it("lanza ModelGroupConflictError si un producto está en OTRO grupo", async () => {
    arrange([], [product({ productId: 1, modelGroupId: 99, modelLabel: "X" })]);

    await expect(
      syncModelGroupMembers(tx as never, GROUP, [{ productId: 1, modelLabel: "M", modelSortOrder: 0 }])
    ).rejects.toThrow(/otro grupo/);
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it("lanza ModelGroupConflictError si el conjunto final rompe una regla (unit distinta)", async () => {
    arrange(
      [],
      [product({ productId: 1, unit: "pieza" }), product({ productId: 2, sku: "CAJA", unit: "caja" })]
    );

    await expect(
      syncModelGroupMembers(tx as never, GROUP, [
        { productId: 1, modelLabel: "M", modelSortOrder: 0 },
        { productId: 2, modelLabel: "L", modelSortOrder: 1 },
      ])
    ).rejects.toThrow(/unidad/);
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it("rechaza servicios y productos sin SKU antes de escribir", async () => {
    arrange([], [product({ productId: 1, isService: true })]);
    await expect(
      syncModelGroupMembers(tx as never, GROUP, [{ productId: 1, modelLabel: "M", modelSortOrder: 0 }])
    ).rejects.toThrow(/servicio/);

    arrange([], [product({ productId: 1, sku: null })]);
    await expect(
      syncModelGroupMembers(tx as never, GROUP, [{ productId: 1, modelLabel: "M", modelSortOrder: 0 }])
    ).rejects.toThrow(/SKU/);
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it("agrega miembros nuevos condicionando al modelGroupId leído (null)", async () => {
    arrange([], [product({ productId: 1 }), product({ productId: 2, sku: "CAM-BAS-L" })]);

    const result = await syncModelGroupMembers(tx as never, GROUP, [
      { productId: 1, modelLabel: "M", modelSortOrder: 0 },
      { productId: 2, modelLabel: "L", modelSortOrder: 1 },
    ]);

    expect(tx.product.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { productId: 1, modelGroupId: null },
      data: { modelGroupId: GROUP, modelLabel: "M", modelSortOrder: 0 },
    });
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { productId: 2, modelGroupId: null },
      data: { modelGroupId: GROUP, modelLabel: "L", modelSortOrder: 1 },
    });
    expect(result.removed).toEqual([]);
    expect(result.changed.map((c) => c.next.productId)).toEqual([1, 2]);
  });

  it("aborta si otro grupo se llevó el producto entre la lectura y el UPDATE", async () => {
    arrange([], [product({ productId: 1 })]);
    tx.product.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      syncModelGroupMembers(tx as never, GROUP, [{ productId: 1, modelLabel: "M", modelSortOrder: 0 }])
    ).rejects.toThrow(/modificado por otra persona/);
  });

  it("suelta a los miembros que ya no vienen en la lista", async () => {
    const staying = product({ productId: 1, modelGroupId: GROUP, modelLabel: "M", modelSortOrder: 0 });
    const leaving = product({ productId: 2, sku: "CAM-BAS-L", modelGroupId: GROUP, modelLabel: "L", modelSortOrder: 1 });
    arrange([staying, leaving], [staying]);

    const result = await syncModelGroupMembers(tx as never, GROUP, [
      { productId: 1, modelLabel: "M", modelSortOrder: 0 },
    ]);

    expect(tx.product.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { productId: 2, modelGroupId: GROUP },
      data: DETACHED,
    });
    expect(result.removed.map((r) => r.productId)).toEqual([2]);
    expect(result.changed).toEqual([]);
  });

  it("no escribe a los miembros sin cambios en etiqueta ni orden", async () => {
    const same = product({ productId: 1, modelGroupId: GROUP, modelLabel: "M", modelSortOrder: 0 });
    arrange([same], [same]);

    await syncModelGroupMembers(tx as never, GROUP, [{ productId: 1, modelLabel: "M", modelSortOrder: 0 }]);

    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it("actualiza solo el orden cuando la etiqueta no cambia (sin soltar antes)", async () => {
    const same = product({ productId: 1, modelGroupId: GROUP, modelLabel: "M", modelSortOrder: 0 });
    arrange([same], [same]);

    await syncModelGroupMembers(tx as never, GROUP, [{ productId: 1, modelLabel: "M", modelSortOrder: 5 }]);

    expect(tx.product.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { productId: 1, modelGroupId: GROUP },
      data: { modelGroupId: GROUP, modelLabel: "M", modelSortOrder: 5 },
    });
  });

  it("al intercambiar etiquetas suelta primero a los que cambian y luego reasigna", async () => {
    const a = product({ productId: 1, modelGroupId: GROUP, modelLabel: "M", modelSortOrder: 0 });
    const b = product({ productId: 2, sku: "CAM-BAS-L", modelGroupId: GROUP, modelLabel: "L", modelSortOrder: 1 });
    arrange([a, b], [a, b]);

    await syncModelGroupMembers(tx as never, GROUP, [
      { productId: 1, modelLabel: "L", modelSortOrder: 0 },
      { productId: 2, modelLabel: "M", modelSortOrder: 1 },
    ]);

    const calls = tx.product.updateMany.mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(4);
    expect(calls[0]).toEqual({ where: { productId: 1, modelGroupId: GROUP }, data: DETACHED });
    expect(calls[1]).toEqual({ where: { productId: 2, modelGroupId: GROUP }, data: DETACHED });
    // Tras soltarlos, la reasignación se condiciona a modelGroupId null.
    expect(calls[2]).toEqual({
      where: { productId: 1, modelGroupId: null },
      data: { modelGroupId: GROUP, modelLabel: "L", modelSortOrder: 0 },
    });
    expect(calls[3]).toEqual({
      where: { productId: 2, modelGroupId: null },
      data: { modelGroupId: GROUP, modelLabel: "M", modelSortOrder: 1 },
    });
  });

  it("acepta a un miembro que ya pertenece al MISMO grupo", async () => {
    const same = product({ productId: 1, modelGroupId: GROUP, modelLabel: "M", modelSortOrder: 0 });
    const fresh = product({ productId: 2, sku: "CAM-BAS-L" });
    arrange([same], [same, fresh]);

    await expect(
      syncModelGroupMembers(tx as never, GROUP, [
        { productId: 1, modelLabel: "M", modelSortOrder: 0 },
        { productId: 2, modelLabel: "L", modelSortOrder: 1 },
      ])
    ).resolves.toMatchObject({ removed: [] });
    expect(tx.product.updateMany).toHaveBeenCalledTimes(1);
  });
});
