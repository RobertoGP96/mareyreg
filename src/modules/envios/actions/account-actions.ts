"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";
import { accountSchema, type AccountInput } from "../lib/schemas";

const revalidateAll = () => {
  revalidatePath("/envios/cuentas");
  revalidatePath("/envios/grupos");
  revalidatePath("/envios/dashboard");
  revalidatePath("/envios/operaciones");
};

export async function createAccount(
  input: AccountInput
): Promise<ActionResult<{ accountId: number }>> {
  try {
    const parsed = accountSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;
    const accountNumber = data.accountNumber.toUpperCase();

    const [group, currency, dup] = await Promise.all([
      db.accountGroup.findUnique({ where: { groupId: data.groupId } }),
      db.currency.findUnique({ where: { currencyId: data.currencyId } }),
      db.account.findFirst({
        where: {
          OR: [
            { accountNumber },
            { groupId: data.groupId, currencyId: data.currencyId },
          ],
        },
      }),
    ]);
    if (!group) return { success: false, error: "Grupo no encontrado" };
    if (!currency) return { success: false, error: "Moneda no encontrada" };
    if (dup) {
      return {
        success: false,
        error: dup.accountNumber === accountNumber
          ? `Ya existe la cuenta "${accountNumber}"`
          : `Ya existe una cuenta de ${currency.code} en este grupo`,
      };
    }

    if (data.exchangeRateRuleId != null) {
      const rule = await db.exchangeRateRule.findUnique({
        where: { ruleId: data.exchangeRateRuleId },
      });
      if (!rule) return { success: false, error: "Regla de tasa no encontrada" };
      if (rule.baseCurrencyId !== data.currencyId) {
        return {
          success: false,
          error: "La regla debe tener como base la misma moneda que la cuenta.",
        };
      }
    }

    const opening = data.openingBalance ?? 0;
    const allowNegative = data.allowNegativeBalance ?? false;
    if (opening < 0 && !allowNegative) {
      return {
        success: false,
        error: "Activa \"Permitir saldo negativo\" para crear con saldo inicial negativo.",
      };
    }
    const userId = await getCurrentUserId();

    const created = await db.$transaction(async (tx) => {
      const a = await tx.account.create({
        data: {
          groupId: data.groupId,
          userId: group.userId,
          currencyId: data.currencyId,
          accountNumber,
          name: data.name,
          balance: opening,
          version: 0,
          exchangeRateRuleId: data.exchangeRateRuleId ?? null,
          active: data.active ?? true,
          allowNegativeBalance: allowNegative,
        },
      });
      if (opening !== 0) {
        await tx.operation.create({
          data: {
            accountId: a.accountId,
            currencyId: a.currencyId,
            type: "adjustment",
            status: "confirmed",
            amount: Math.abs(opening),
            description: "Saldo inicial",
            balanceAfter: opening,
            confirmedAt: new Date(),
            createdById: userId ?? null,
            confirmedById: userId ?? null,
          },
        });
      }
      await createAuditLog(tx, {
        action: "create",
        entityType: "Account",
        entityId: a.accountId,
        module: "envios",
        userId,
        newValues: { ...data, accountNumber },
      });
      return a;
    });

    revalidateAll();
    return { success: true, data: { accountId: created.accountId } };
  } catch (error) {
    console.error("createAccount:", error);
    return { success: false, error: "Error al crear la cuenta" };
  }
}

export async function updateAccount(
  id: number,
  input: {
    name?: string;
    exchangeRateRuleId?: number | null;
    accountNumber?: string;
    allowNegativeBalance?: boolean;
  }
): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.account.findUnique({ where: { accountId: id } });
      if (!prev) throw new Error("Cuenta no encontrada");

      let nextNumber: string | undefined;
      if (input.accountNumber !== undefined) {
        nextNumber = input.accountNumber.toUpperCase();
        if (!/^[A-Z0-9_-]+$/.test(nextNumber) || nextNumber.length < 2) {
          throw new Error("Número de cuenta inválido");
        }
        const dup = await tx.account.findFirst({
          where: { accountNumber: nextNumber, NOT: { accountId: id } },
        });
        if (dup) throw new Error(`Ya existe la cuenta "${nextNumber}"`);
      }

      if (input.exchangeRateRuleId != null) {
        const rule = await tx.exchangeRateRule.findUnique({
          where: { ruleId: input.exchangeRateRuleId },
        });
        if (!rule) throw new Error("Regla de tasa no encontrada");
        if (rule.baseCurrencyId !== prev.currencyId) {
          throw new Error("La regla debe tener como base la moneda de la cuenta");
        }
      }

      // No permitir desactivar el flag si la cuenta está actualmente en rojo:
      // dejaría el balance por debajo del CHECK al primer movimiento.
      if (
        input.allowNegativeBalance === false &&
        prev.allowNegativeBalance === true &&
        Number(prev.balance) < 0
      ) {
        throw new Error(
          "No se puede desactivar saldo negativo: la cuenta está actualmente en rojo. Compensa el saldo primero."
        );
      }

      await tx.account.update({
        where: { accountId: id },
        data: {
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.accountNumber !== undefined && nextNumber && { accountNumber: nextNumber }),
          ...(input.exchangeRateRuleId !== undefined && {
            exchangeRateRuleId: input.exchangeRateRuleId ?? null,
          }),
          ...(input.allowNegativeBalance !== undefined && {
            allowNegativeBalance: input.allowNegativeBalance,
          }),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Account",
        entityId: id,
        module: "envios",
        userId,
        oldValues: prev,
        newValues: input,
      });
    });

    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar la cuenta";
    console.error("updateAccount:", error);
    return { success: false, error: message };
  }
}

export async function toggleAccountActive(
  id: number
): Promise<ActionResult<{ active: boolean }>> {
  try {
    const userId = await getCurrentUserId();
    const next = await db.$transaction(async (tx) => {
      const prev = await tx.account.findUnique({ where: { accountId: id } });
      if (!prev) throw new Error("Cuenta no encontrada");
      const updated = await tx.account.update({
        where: { accountId: id },
        data: { active: !prev.active },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Account",
        entityId: id,
        module: "envios",
        userId,
        oldValues: { active: prev.active },
        newValues: { active: updated.active },
      });
      return updated.active;
    });
    revalidateAll();
    return { success: true, data: { active: next } };
  } catch (error) {
    console.error("toggleAccountActive:", error);
    return { success: false, error: "Error al cambiar el estado" };
  }
}

export async function deleteAccount(id: number): Promise<ActionResult<void>> {
  try {
    const linked = await db.operation.count({ where: { accountId: id } });
    if (linked > 0) {
      return {
        success: false,
        error: `No se puede eliminar: ${linked} operación(es) registradas. Desactívala en su lugar.`,
      };
    }
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.account.findUnique({ where: { accountId: id } });
      await tx.account.delete({ where: { accountId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "Account",
        entityId: id,
        module: "envios",
        userId,
        oldValues: prev,
      });
    });
    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    console.error("deleteAccount:", error);
    return { success: false, error: "Error al eliminar la cuenta" };
  }
}
