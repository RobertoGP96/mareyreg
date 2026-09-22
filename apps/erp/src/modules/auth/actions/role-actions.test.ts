import { describe, it, expect, vi, beforeEach } from "vitest";

const { revalidatePath, createAuditLog, requireCurrentUserId, assertRole, tx, db, ForbiddenError } =
  vi.hoisted(() => {
    class ForbiddenError extends Error {
      constructor(message = "No tienes permisos para realizar esta acción") {
        super(message);
        this.name = "ForbiddenError";
      }
    }
    const tx = {
      roleModulePermission: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
    };
    const db = {
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    };
    return {
      revalidatePath: vi.fn(),
      createAuditLog: vi.fn().mockResolvedValue(undefined),
      requireCurrentUserId: vi.fn().mockResolvedValue(7),
      assertRole: vi.fn().mockResolvedValue(undefined),
      tx,
      db,
      ForbiddenError,
    };
  });

vi.mock("@/lib/db", () => ({ db }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({ requireCurrentUserId, createAuditLog }));
vi.mock("@/lib/auth-guard", () => ({ assertRole, ForbiddenError }));
vi.mock("@/lib/module-registry", () => ({
  getEnabledModuleIds: () => ["inventory", "sales", "entregas"],
}));

import { updateRoleModules } from "./role-actions";

describe("updateRoleModules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    tx.roleModulePermission.findMany.mockResolvedValue([{ moduleId: "inventory" }]);
  });

  it("reemplaza los módulos del rol, audita y revalida", async () => {
    const result = await updateRoleModules("dispatcher", ["sales", "entregas"]);

    expect(result).toEqual({ success: true, data: { moduleIds: ["sales", "entregas"] } });
    expect(assertRole).toHaveBeenCalledWith("admin");
    expect(tx.roleModulePermission.deleteMany).toHaveBeenCalledWith({
      where: { role: "dispatcher" },
    });
    expect(tx.roleModulePermission.createMany).toHaveBeenCalledWith({
      data: [
        { role: "dispatcher", moduleId: "sales" },
        { role: "dispatcher", moduleId: "entregas" },
      ],
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: "update",
        entityType: "Role",
        module: "auth",
        userId: 7,
        oldValues: { role: "dispatcher", moduleIds: ["inventory"] },
        newValues: { role: "dispatcher", moduleIds: ["sales", "entregas"] },
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/settings/roles");
    expect(revalidatePath).toHaveBeenCalledWith("/settings/roles/dispatcher");
    expect(revalidatePath).toHaveBeenCalledWith("/settings/users");
  });

  it("ignora ids que no son módulos habilitados", async () => {
    const result = await updateRoleModules("viewer", ["sales", "payments", "x"]);

    expect(result).toEqual({ success: true, data: { moduleIds: ["sales"] } });
    expect(tx.roleModulePermission.createMany).toHaveBeenCalledWith({
      data: [{ role: "viewer", moduleId: "sales" }],
    });
  });

  it("con lista vacía borra sin crear filas", async () => {
    const result = await updateRoleModules("viewer", []);

    expect(result.success).toBe(true);
    expect(tx.roleModulePermission.deleteMany).toHaveBeenCalled();
    expect(tx.roleModulePermission.createMany).not.toHaveBeenCalled();
  });

  it("rechaza editar los módulos del administrador", async () => {
    const result = await updateRoleModules("admin", ["sales"]);

    expect(result.success).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza un rol inexistente", async () => {
    const result = await updateRoleModules("owner" as never, ["sales"]);

    expect(result.success).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("devuelve el mensaje de ForbiddenError sin tocar la base", async () => {
    assertRole.mockRejectedValueOnce(new ForbiddenError());

    const result = await updateRoleModules("viewer", ["sales"]);

    expect(result).toEqual({
      success: false,
      error: "No tienes permisos para realizar esta acción",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
