"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import { accountGroupSchema, type AccountGroupInput } from "../lib/schemas";

const AUTH_ERROR_MESSAGE = "Debes iniciar sesión para realizar esta acción.";
const FORBIDDEN_ERROR_MESSAGE = "No tienes permisos para realizar esta acción";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

function isForbiddenError(error: unknown): boolean {
  return error instanceof ForbiddenError;
}

// AccountGroup afecta la lista de grupos y las cuentas que agrupa; el
// dashboard tambien puede mostrar totales por grupo.
const revalidateAccountGroups = () => {
  revalidatePath("/envios/grupos");
  revalidatePath("/envios/cuentas");
  revalidatePath("/envios/dashboard");
};

export async function createAccountGroup(
  input: AccountGroupInput
): Promise<ActionResult<{ groupId: number }>> {
  try {
    const parsed = accountGroupSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;
    const dup = await db.accountGroup.findUnique({ where: { code: data.code } });
    if (dup) return { success: false, error: `Ya existe el grupo "${data.code}"` };

    const owner = await db.user.findUnique({ where: { userId: data.userId } });
    if (!owner) return { success: false, error: "Responsable no encontrado" };

    const userId = await requireCurrentUserId();
    const created = await db.$transaction(async (tx) => {
      const g = await tx.accountGroup.create({
        data: {
          code: data.code,
          name: data.name,
          description: data.description?.trim() || null,
          userId: data.userId,
          active: data.active ?? true,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "AccountGroup",
        entityId: g.groupId,
        module: "envios",
        userId,
        newValues: data,
      });
      return g;
    });

    revalidateAccountGroups();
    return { success: true, data: { groupId: created.groupId } };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("createAccountGroup:", error);
    return { success: false, error: "Error al crear el grupo" };
  }
}

export async function updateAccountGroup(
  id: number,
  input: Partial<AccountGroupInput>
): Promise<ActionResult<void>> {
  try {
    if (input.code !== undefined) {
      const parsed = accountGroupSchema.shape.code.safeParse(input.code);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Código inválido" };
      const dup = await db.accountGroup.findFirst({
        where: { code: parsed.data, NOT: { groupId: id } },
      });
      if (dup) return { success: false, error: `Ya existe el grupo "${parsed.data}"` };
    }
    if (input.userId !== undefined) {
      const owner = await db.user.findUnique({ where: { userId: input.userId } });
      if (!owner) return { success: false, error: "Responsable no encontrado" };
    }

    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.accountGroup.findUnique({ where: { groupId: id } });
      if (!prev) throw new Error("Grupo no encontrado");
      await tx.accountGroup.update({
        where: { groupId: id },
        data: {
          ...(input.code !== undefined && { code: input.code }),
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.description !== undefined && { description: input.description?.trim() || null }),
          ...(input.userId !== undefined && { userId: input.userId }),
          ...(input.active !== undefined && { active: input.active }),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "AccountGroup",
        entityId: id,
        module: "envios",
        userId,
        oldValues: prev,
        newValues: input,
      });
    });

    revalidateAccountGroups();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("updateAccountGroup:", error);
    return { success: false, error: "Error al actualizar el grupo" };
  }
}

export async function toggleAccountGroup(
  id: number
): Promise<ActionResult<{ active: boolean }>> {
  try {
    const userId = await requireCurrentUserId();
    const next = await db.$transaction(async (tx) => {
      const prev = await tx.accountGroup.findUnique({ where: { groupId: id } });
      if (!prev) throw new Error("Grupo no encontrado");
      const updated = await tx.accountGroup.update({
        where: { groupId: id },
        data: { active: !prev.active },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "AccountGroup",
        entityId: id,
        module: "envios",
        userId,
        oldValues: { active: prev.active },
        newValues: { active: updated.active },
      });
      return updated.active;
    });
    revalidateAccountGroups();
    return { success: true, data: { active: next } };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("toggleAccountGroup:", error);
    return { success: false, error: "Error al cambiar el estado" };
  }
}

export async function deleteAccountGroup(id: number): Promise<ActionResult<void>> {
  try {
    const linked = await db.account.count({ where: { groupId: id } });
    if (linked > 0) {
      return {
        success: false,
        error: `No se puede eliminar: ${linked} cuenta(s) en el grupo. Desactívalo en su lugar.`,
      };
    }
    const userId = await requireCurrentUserId();
    await assertRole("admin");
    await db.$transaction(async (tx) => {
      const prev = await tx.accountGroup.findUnique({ where: { groupId: id } });
      await tx.accountGroup.delete({ where: { groupId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "AccountGroup",
        entityId: id,
        module: "envios",
        userId,
        oldValues: prev,
      });
    });
    revalidateAccountGroups();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    if (isForbiddenError(error)) return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    console.error("deleteAccountGroup:", error);
    return { success: false, error: "Error al eliminar el grupo" };
  }
}
