"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";
import {
  exchangeRateRuleSchema,
  assignAccountRulesSchema,
  type ExchangeRateRuleInput,
  type AssignAccountRulesInput,
} from "../lib/schemas";
import {
  computeAccountRateCoverage,
  type CoverageReport,
} from "../lib/exchange-rate";

const revalidateAll = () => {
  revalidatePath("/envios/tasas");
  revalidatePath("/envios/cuentas");
  revalidatePath("/envios/operaciones");
  revalidatePath("/envios/dashboard");
};

function describeDbError(error: unknown, fallback: string): string {
  const msg = error instanceof Error ? error.message : "";
  if (msg.includes("err_account_rates_overlap")) {
    return "Las reglas asignadas se solapan en el mismo rango. Ajusta los mínimos/máximos antes de asignar.";
  }
  if (msg.includes("err_min_nonneg")) return "El monto mínimo no puede ser negativo";
  if (msg.includes("err_rate_pos")) return "La tasa debe ser mayor a 0";
  if (msg.includes("err_max_gt_min")) return "El máximo debe ser mayor que el mínimo";
  return fallback;
}

export async function createExchangeRateRule(
  input: ExchangeRateRuleInput,
): Promise<ActionResult<{ ruleId: number }>> {
  try {
    const parsed = exchangeRateRuleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;

    const dup = await db.exchangeRateRule.findFirst({
      where: {
        name: data.name,
        baseCurrencyId: data.baseCurrencyId,
        quoteCurrencyId: data.quoteCurrencyId,
      },
    });
    if (dup) return { success: false, error: `Ya existe una regla "${data.name}" con ese par.` };

    const userId = await getCurrentUserId();
    const created = await db.$transaction(async (tx) => {
      const r = await tx.exchangeRateRule.create({
        data: {
          name: data.name,
          baseCurrencyId: data.baseCurrencyId,
          quoteCurrencyId: data.quoteCurrencyId,
          minAmount: data.minAmount,
          maxAmount: data.maxAmount ?? null,
          rate: data.rate,
          active: data.active ?? true,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "ExchangeRateRule",
        entityId: r.ruleId,
        module: "envios",
        userId,
        newValues: data,
      });
      return r;
    });

    revalidateAll();
    return { success: true, data: { ruleId: created.ruleId } };
  } catch (error) {
    console.error("createExchangeRateRule:", error);
    return { success: false, error: describeDbError(error, "Error al crear la regla") };
  }
}

export async function updateExchangeRateRule(
  id: number,
  input: Partial<ExchangeRateRuleInput>,
): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.exchangeRateRule.findUnique({ where: { ruleId: id } });
      if (!prev) throw new Error("Regla no encontrada");

      const data: Record<string, unknown> = { version: { increment: 1 } };
      if (input.name !== undefined) data.name = input.name.trim();
      if (input.baseCurrencyId !== undefined) data.baseCurrencyId = input.baseCurrencyId;
      if (input.quoteCurrencyId !== undefined) data.quoteCurrencyId = input.quoteCurrencyId;
      if (input.minAmount !== undefined) data.minAmount = input.minAmount;
      if (input.maxAmount !== undefined) data.maxAmount = input.maxAmount ?? null;
      if (input.rate !== undefined) data.rate = input.rate;
      if (input.active !== undefined) data.active = input.active;

      const updated = await tx.exchangeRateRule.updateMany({
        where: { ruleId: id, version: prev.version },
        data,
      });
      if (updated.count === 0) {
        throw new Error("La regla cambió mientras la editabas. Recarga e intenta de nuevo.");
      }

      await createAuditLog(tx, {
        action: "update",
        entityType: "ExchangeRateRule",
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
    console.error("updateExchangeRateRule:", error);
    const fallback = error instanceof Error ? error.message : "Error al actualizar la regla";
    return { success: false, error: describeDbError(error, fallback) };
  }
}

export async function toggleExchangeRateRule(
  id: number,
): Promise<ActionResult<{ active: boolean }>> {
  try {
    const userId = await getCurrentUserId();
    const next = await db.$transaction(async (tx) => {
      const prev = await tx.exchangeRateRule.findUnique({ where: { ruleId: id } });
      if (!prev) throw new Error("Regla no encontrada");
      const updated = await tx.exchangeRateRule.update({
        where: { ruleId: id },
        data: { active: !prev.active, version: { increment: 1 } },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "ExchangeRateRule",
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
    console.error("toggleExchangeRateRule:", error);
    return { success: false, error: describeDbError(error, "Error al cambiar el estado") };
  }
}

export async function deleteExchangeRateRule(id: number): Promise<ActionResult<void>> {
  try {
    const linked = await db.accountExchangeRateRule.count({ where: { ruleId: id } });
    if (linked > 0) {
      return {
        success: false,
        error: `No se puede eliminar: ${linked} cuenta(s) usan esta regla. Quítala de las cuentas o desactívala primero.`,
      };
    }
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.exchangeRateRule.findUnique({ where: { ruleId: id } });
      await tx.exchangeRateRule.delete({ where: { ruleId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "ExchangeRateRule",
        entityId: id,
        module: "envios",
        userId,
        oldValues: prev,
      });
    });
    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    console.error("deleteExchangeRateRule:", error);
    return { success: false, error: describeDbError(error, "Error al eliminar la regla") };
  }
}

export async function assignRulesToAccount(
  input: AssignAccountRulesInput,
): Promise<ActionResult<{ assigned: number; removed: number }>> {
  try {
    const parsed = assignAccountRulesSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { accountId, ruleIds } = parsed.data;

    const userId = await getCurrentUserId();
    const result = await db.$transaction(async (tx) => {
      const account = await tx.account.findUnique({ where: { accountId } });
      if (!account) throw new Error("Cuenta no encontrada");

      const current = await tx.accountExchangeRateRule.findMany({
        where: { accountId },
        select: { ruleId: true },
      });
      const currentSet = new Set(current.map((r) => r.ruleId));
      const targetSet = new Set(ruleIds);

      const toAdd = ruleIds.filter((r) => !currentSet.has(r));
      const toRemove = [...currentSet].filter((r) => !targetSet.has(r));

      if (toRemove.length > 0) {
        await tx.accountExchangeRateRule.deleteMany({
          where: { accountId, ruleId: { in: toRemove } },
        });
      }
      if (toAdd.length > 0) {
        await tx.accountExchangeRateRule.createMany({
          data: toAdd.map((ruleId) => ({ accountId, ruleId })),
          skipDuplicates: true,
        });
      }

      await createAuditLog(tx, {
        action: "update",
        entityType: "AccountExchangeRateRule",
        entityId: accountId,
        module: "envios",
        userId,
        oldValues: { ruleIds: [...currentSet] },
        newValues: { ruleIds },
      });

      return { assigned: toAdd.length, removed: toRemove.length };
    });

    revalidateAll();
    return { success: true, data: result };
  } catch (error) {
    console.error("assignRulesToAccount:", error);
    return { success: false, error: describeDbError(error, "Error al asignar reglas") };
  }
}

export async function unassignRuleFromAccount(
  accountId: number,
  ruleId: number,
): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      await tx.accountExchangeRateRule.delete({
        where: { accountId_ruleId: { accountId, ruleId } },
      });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "AccountExchangeRateRule",
        entityId: accountId,
        module: "envios",
        userId,
        oldValues: { accountId, ruleId },
      });
    });
    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    console.error("unassignRuleFromAccount:", error);
    return { success: false, error: describeDbError(error, "Error al quitar la regla") };
  }
}

export async function validateAccountRateCoverage(args: {
  accountId: number;
  baseCurrencyId: number;
  quoteCurrencyId: number;
}): Promise<ActionResult<CoverageReport>> {
  try {
    const report = await computeAccountRateCoverage(db, args);
    return { success: true, data: report };
  } catch (error) {
    console.error("validateAccountRateCoverage:", error);
    return { success: false, error: "Error al calcular la cobertura" };
  }
}
