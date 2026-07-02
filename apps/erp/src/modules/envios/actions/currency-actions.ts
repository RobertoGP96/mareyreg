"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import { currencySchema, type CurrencyInput } from "../lib/schemas";

const AUTH_ERROR_MESSAGE = "Debes iniciar sesión para realizar esta acción.";
const FORBIDDEN_ERROR_MESSAGE = "No tienes permisos para realizar esta acción";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

function isForbiddenError(error: unknown): boolean {
  return error instanceof ForbiddenError;
}

// Currency es referenciada por Account (cuentas) y ExchangeRateRule (tasas);
// el dashboard tambien agrupa balances por moneda. Todas las mutaciones de
// este archivo (crear/editar/activar/eliminar) comparten el mismo impacto.
const revalidateCurrencies = () => {
  revalidatePath("/envios/monedas");
  revalidatePath("/envios/dashboard");
  revalidatePath("/envios/cuentas");
  revalidatePath("/envios/tasas");
};

export async function createCurrency(
  input: CurrencyInput
): Promise<ActionResult<{ currencyId: number }>> {
  try {
    const parsed = currencySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;
    const dup = await db.currency.findUnique({ where: { code: data.code } });
    if (dup) return { success: false, error: `Ya existe la moneda "${data.code}"` };

    const userId = await requireCurrentUserId();
    const created = await db.$transaction(async (tx) => {
      const c = await tx.currency.create({
        data: {
          code: data.code,
          name: data.name,
          symbol: data.symbol,
          decimalPlaces: data.decimalPlaces,
          active: data.active ?? true,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "Currency",
        entityId: c.currencyId,
        module: "envios",
        userId,
        newValues: data,
      });
      return c;
    });

    revalidateCurrencies();
    return { success: true, data: { currencyId: created.currencyId } };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("createCurrency:", error);
    return { success: false, error: "Error al crear la moneda" };
  }
}

export async function updateCurrency(
  id: number,
  input: Partial<CurrencyInput>
): Promise<ActionResult<void>> {
  try {
    if (input.code !== undefined) {
      const parsed = currencySchema.shape.code.safeParse(input.code);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Código inválido" };
      const dup = await db.currency.findFirst({
        where: { code: parsed.data, NOT: { currencyId: id } },
      });
      if (dup) return { success: false, error: `Ya existe la moneda "${parsed.data}"` };
    }

    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.currency.findUnique({ where: { currencyId: id } });
      if (!prev) throw new Error("Moneda no encontrada");
      await tx.currency.update({
        where: { currencyId: id },
        data: {
          ...(input.code !== undefined && { code: input.code }),
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.symbol !== undefined && { symbol: input.symbol.trim() }),
          ...(input.decimalPlaces !== undefined && { decimalPlaces: input.decimalPlaces }),
          ...(input.active !== undefined && { active: input.active }),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Currency",
        entityId: id,
        module: "envios",
        userId,
        oldValues: prev,
        newValues: input,
      });
    });

    revalidateCurrencies();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("updateCurrency:", error);
    return { success: false, error: "Error al actualizar la moneda" };
  }
}

export async function toggleCurrency(id: number): Promise<ActionResult<{ active: boolean }>> {
  try {
    const userId = await requireCurrentUserId();
    const next = await db.$transaction(async (tx) => {
      const prev = await tx.currency.findUnique({ where: { currencyId: id } });
      if (!prev) throw new Error("Moneda no encontrada");
      const updated = await tx.currency.update({
        where: { currencyId: id },
        data: { active: !prev.active },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Currency",
        entityId: id,
        module: "envios",
        userId,
        oldValues: { active: prev.active },
        newValues: { active: updated.active },
      });
      return updated.active;
    });
    revalidateCurrencies();
    return { success: true, data: { active: next } };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("toggleCurrency:", error);
    return { success: false, error: "Error al cambiar el estado" };
  }
}

export async function deleteCurrency(id: number): Promise<ActionResult<void>> {
  try {
    const linked = await db.account.count({ where: { currencyId: id } });
    if (linked > 0) {
      return {
        success: false,
        error: `No se puede eliminar: ${linked} cuenta(s) usan esta moneda. Desactívala en su lugar.`,
      };
    }
    const userId = await requireCurrentUserId();
    await assertRole("admin");
    await db.$transaction(async (tx) => {
      const prev = await tx.currency.findUnique({ where: { currencyId: id } });
      await tx.currency.delete({ where: { currencyId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "Currency",
        entityId: id,
        module: "envios",
        userId,
        oldValues: prev,
      });
    });
    revalidateCurrencies();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    if (isForbiddenError(error)) return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    console.error("deleteCurrency:", error);
    return { success: false, error: "Error al eliminar la moneda" };
  }
}
