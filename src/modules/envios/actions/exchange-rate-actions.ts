"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";
import { exchangeRateRuleSchema, type ExchangeRateRuleInput } from "../lib/schemas";

const revalidateAll = () => {
  revalidatePath("/envios/tasas");
  revalidatePath("/envios/cuentas");
  revalidatePath("/envios/operaciones");
  revalidatePath("/envios/dashboard");
};

export async function createExchangeRateRule(
  input: ExchangeRateRuleInput
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
          active: data.active ?? true,
          ranges: {
            createMany: {
              data: data.ranges
                .sort((a, b) => a.minAmount - b.minAmount)
                .map((rg) => ({
                  minAmount: rg.minAmount,
                  maxAmount: rg.maxAmount ?? null,
                  rate: rg.rate,
                })),
            },
          },
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
    const msg = error instanceof Error && error.message.includes("err_no_overlap")
      ? "Los rangos no pueden solaparse"
      : "Error al crear la regla";
    return { success: false, error: msg };
  }
}

export async function updateExchangeRateRule(
  id: number,
  input: Partial<ExchangeRateRuleInput>
): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.exchangeRateRule.findUnique({
        where: { ruleId: id },
        include: { ranges: true },
      });
      if (!prev) throw new Error("Regla no encontrada");

      await tx.exchangeRateRule.update({
        where: { ruleId: id },
        data: {
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.baseCurrencyId !== undefined && { baseCurrencyId: input.baseCurrencyId }),
          ...(input.quoteCurrencyId !== undefined && { quoteCurrencyId: input.quoteCurrencyId }),
          ...(input.active !== undefined && { active: input.active }),
        },
      });

      if (input.ranges) {
        // Reemplazar todos los rangos atómicamente
        await tx.exchangeRateRange.deleteMany({ where: { exchangeRateRuleId: id } });
        await tx.exchangeRateRange.createMany({
          data: [...input.ranges]
            .sort((a, b) => a.minAmount - b.minAmount)
            .map((rg) => ({
              exchangeRateRuleId: id,
              minAmount: rg.minAmount,
              maxAmount: rg.maxAmount ?? null,
              rate: rg.rate,
            })),
        });
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
    const msg = error instanceof Error && error.message.includes("err_no_overlap")
      ? "Los rangos no pueden solaparse"
      : error instanceof Error ? error.message : "Error al actualizar la regla";
    console.error("updateExchangeRateRule:", error);
    return { success: false, error: msg };
  }
}

export async function toggleExchangeRateRule(
  id: number
): Promise<ActionResult<{ active: boolean }>> {
  try {
    const userId = await getCurrentUserId();
    const next = await db.$transaction(async (tx) => {
      const prev = await tx.exchangeRateRule.findUnique({ where: { ruleId: id } });
      if (!prev) throw new Error("Regla no encontrada");
      const updated = await tx.exchangeRateRule.update({
        where: { ruleId: id },
        data: { active: !prev.active },
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
    return { success: false, error: "Error al cambiar el estado" };
  }
}

export async function deleteExchangeRateRule(id: number): Promise<ActionResult<void>> {
  try {
    const linked = await db.account.count({ where: { exchangeRateRuleId: id } });
    if (linked > 0) {
      return {
        success: false,
        error: `No se puede eliminar: ${linked} cuenta(s) usan esta regla. Desactívala o reasigna primero.`,
      };
    }
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.exchangeRateRule.findUnique({
        where: { ruleId: id },
        include: { ranges: true },
      });
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
    return { success: false, error: "Error al eliminar la regla" };
  }
}
