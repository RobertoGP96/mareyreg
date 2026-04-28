"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";
import { applyDelta, BalanceError, ConcurrencyError } from "../lib/balance";
import { resolveRate, RateNotConfiguredError } from "../lib/exchange-rate";
import { transferSchema, type TransferInput } from "../lib/schemas";

const revalidateAll = () => {
  revalidatePath("/envios/operaciones");
  revalidatePath("/envios/pendientes");
  revalidatePath("/envios/cuentas");
  revalidatePath("/envios/grupos");
  revalidatePath("/envios/dashboard");
};

function generateReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TRF-${ts}-${rand}`;
}

/**
 * Previsualiza tasa y monto convertido sin ejecutar transferencia.
 * Usado por el form para mostrar "Recibirá ≈ X".
 */
export async function previewTransferRate(input: {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
}): Promise<
  ActionResult<{
    rate: number;
    rangeMin: number;
    rangeMax: number | null;
    amountTo: number;
    direction: "base_to_quote" | "quote_to_base";
    quoteCurrencyCode: string;
  }>
> {
  try {
    if (!input.amount || input.amount <= 0) {
      return { success: false, error: "Monto inválido" };
    }
    const [from, to] = await Promise.all([
      db.account.findUnique({
        where: { accountId: input.fromAccountId },
        include: {
          exchangeRateRule: { include: { baseCurrency: true, quoteCurrency: true } },
          currency: true,
        },
      }),
      db.account.findUnique({
        where: { accountId: input.toAccountId },
        include: { currency: true },
      }),
    ]);
    if (!from || !to) return { success: false, error: "Cuenta no encontrada" };
    if (!from.exchangeRateRule) {
      return { success: false, error: "La cuenta origen no tiene regla de tasa asignada" };
    }

    const rule = from.exchangeRateRule;
    let direction: "base_to_quote" | "quote_to_base";
    if (rule.baseCurrencyId === from.currencyId && rule.quoteCurrencyId === to.currencyId) {
      direction = "base_to_quote";
    } else if (rule.quoteCurrencyId === from.currencyId && rule.baseCurrencyId === to.currencyId) {
      direction = "quote_to_base";
    } else {
      return {
        success: false,
        error: `La regla "${rule.name}" no convierte ${from.currency.code} → ${to.currency.code}`,
      };
    }

    // El rango se evalúa en moneda BASE de la regla
    const amountInBase =
      direction === "base_to_quote" ? input.amount : input.amount; // si es quote→base, el amount sigue siendo el del lado origen
    const resolved = await resolveRate(db, rule.ruleId, amountInBase);
    const amountTo =
      direction === "base_to_quote"
        ? input.amount * resolved.rate
        : input.amount / resolved.rate;

    return {
      success: true,
      data: {
        rate: resolved.rate,
        rangeMin: resolved.minAmount,
        rangeMax: resolved.maxAmount,
        amountTo,
        direction,
        quoteCurrencyCode: to.currency.code,
      },
    };
  } catch (error) {
    if (error instanceof RateNotConfiguredError) {
      return { success: false, error: error.message };
    }
    console.error("previewTransferRate:", error);
    return { success: false, error: "Error al calcular la tasa" };
  }
}

export async function createTransfer(
  input: TransferInput
): Promise<ActionResult<{ reference: string; outId: number; inId: number; rate: number; amountTo: number }>> {
  try {
    const parsed = transferSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;
    const userId = await getCurrentUserId();
    const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();
    const status = data.status ?? "confirmed";
    const reference = generateReference();

    const result = await db.$transaction(async (tx) => {
      const from = await tx.account.findUniqueOrThrow({
        where: { accountId: data.fromAccountId },
        include: {
          exchangeRateRule: true,
          currency: true,
        },
      });
      const to = await tx.account.findUniqueOrThrow({
        where: { accountId: data.toAccountId },
        include: { currency: true },
      });
      if (!from.active) throw new Error("La cuenta origen está inactiva");
      if (!to.active) throw new Error("La cuenta destino está inactiva");
      if (!from.exchangeRateRule) throw new Error("La cuenta origen no tiene regla de tasa");

      const rule = from.exchangeRateRule;
      let direction: "base_to_quote" | "quote_to_base";
      if (rule.baseCurrencyId === from.currencyId && rule.quoteCurrencyId === to.currencyId) {
        direction = "base_to_quote";
      } else if (rule.quoteCurrencyId === from.currencyId && rule.baseCurrencyId === to.currencyId) {
        direction = "quote_to_base";
      } else {
        throw new Error(
          `La regla "${rule.name}" no convierte ${from.currency.code} → ${to.currency.code}`
        );
      }

      const rate = data.rateOverride ?? (await resolveRate(tx, rule.ruleId, data.amount)).rate;
      const amountTo =
        direction === "base_to_quote" ? data.amount * rate : data.amount / rate;

      let outBalance: number, inBalance: number;
      if (status === "confirmed") {
        const outResult = await applyDelta(tx, from.accountId, -data.amount);
        outBalance = outResult.newBalance;
        const inResult = await applyDelta(tx, to.accountId, +amountTo);
        inBalance = inResult.newBalance;
      } else {
        outBalance = Number(from.balance);
        inBalance = Number(to.balance);
      }

      const description = `${from.name} → ${to.name} @ ${rate}`;

      const outOp = await tx.operation.create({
        data: {
          accountId: from.accountId,
          currencyId: from.currencyId,
          type: "transfer_out",
          status,
          amount: data.amount,
          description: data.description?.trim() || description,
          reference,
          balanceAfter: outBalance,
          exchangeRateRuleId: rule.ruleId,
          rateApplied: rate,
          counterAmount: amountTo,
          counterCurrencyId: to.currencyId,
          occurredAt,
          confirmedAt: status === "confirmed" ? new Date() : null,
          createdById: userId ?? null,
          confirmedById: status === "confirmed" ? userId ?? null : null,
        },
      });
      const inOp = await tx.operation.create({
        data: {
          accountId: to.accountId,
          currencyId: to.currencyId,
          type: "transfer_in",
          status,
          amount: amountTo,
          description: data.description?.trim() || description,
          reference,
          balanceAfter: inBalance,
          exchangeRateRuleId: rule.ruleId,
          rateApplied: rate,
          counterAmount: data.amount,
          counterCurrencyId: from.currencyId,
          occurredAt,
          confirmedAt: status === "confirmed" ? new Date() : null,
          createdById: userId ?? null,
          confirmedById: status === "confirmed" ? userId ?? null : null,
        },
      });

      await createAuditLog(tx, {
        action: "create",
        entityType: "Transfer",
        entityId: outOp.operationId,
        module: "envios",
        userId,
        newValues: {
          ...data,
          reference,
          rate,
          amountTo,
          direction,
          status,
        },
      });

      return { reference, outId: outOp.operationId, inId: inOp.operationId, rate, amountTo };
    });

    revalidateAll();
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof BalanceError) return { success: false, error: error.message };
    if (error instanceof ConcurrencyError) return { success: false, error: "Conflicto de concurrencia, reintenta" };
    if (error instanceof RateNotConfiguredError) return { success: false, error: error.message };
    const msg = error instanceof Error ? error.message : "Error al crear la transferencia";
    console.error("createTransfer:", error);
    return { success: false, error: msg };
  }
}

export async function confirmTransfer(
  reference: string
): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const ops = await tx.operation.findMany({
        where: { reference, status: "pending" },
        orderBy: { type: "desc" }, // transfer_out primero alfabéticamente sí, pero aplicamos por type explícito
      });
      const out = ops.find((o) => o.type === "transfer_out");
      const incoming = ops.find((o) => o.type === "transfer_in");
      if (!out || !incoming) throw new Error("Pareja de transferencia no encontrada o ya confirmada");

      const outResult = await applyDelta(tx, out.accountId, -Number(out.amount));
      const inResult = await applyDelta(tx, incoming.accountId, +Number(incoming.amount));

      await tx.operation.update({
        where: { operationId: out.operationId },
        data: {
          status: "confirmed",
          balanceAfter: outResult.newBalance,
          confirmedAt: new Date(),
          confirmedById: userId ?? null,
        },
      });
      await tx.operation.update({
        where: { operationId: incoming.operationId },
        data: {
          status: "confirmed",
          balanceAfter: inResult.newBalance,
          confirmedAt: new Date(),
          confirmedById: userId ?? null,
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Transfer",
        entityId: out.operationId,
        module: "envios",
        userId,
        oldValues: { status: "pending" },
        newValues: { status: "confirmed", reference },
      });
    });

    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof BalanceError) return { success: false, error: error.message };
    if (error instanceof ConcurrencyError) return { success: false, error: "Conflicto de concurrencia, reintenta" };
    const msg = error instanceof Error ? error.message : "Error al confirmar transferencia";
    console.error("confirmTransfer:", error);
    return { success: false, error: msg };
  }
}

export async function cancelTransfer(reference: string): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const ops = await tx.operation.findMany({
        where: { reference, status: "pending" },
      });
      if (!ops.length) throw new Error("Transferencia no encontrada o ya procesada");
      await tx.operation.updateMany({
        where: { reference, status: "pending" },
        data: { status: "cancelled", confirmedAt: null, confirmedById: null },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Transfer",
        entityId: ops[0].operationId,
        module: "envios",
        userId,
        oldValues: { status: "pending" },
        newValues: { status: "cancelled", reference },
      });
    });
    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al cancelar transferencia";
    console.error("cancelTransfer:", error);
    return { success: false, error: msg };
  }
}

export async function bulkConfirmOperations(
  operationIds: number[]
): Promise<ActionResult<{ confirmed: number; failed: { id: number; error: string }[] }>> {
  try {
    if (!operationIds.length) {
      return { success: true, data: { confirmed: 0, failed: [] } };
    }
    const userId = await getCurrentUserId();
    let confirmed = 0;
    const failed: { id: number; error: string }[] = [];

    // Procesar de a uno: cada op puede tener errores propios (saldo insuficiente, etc.)
    for (const id of operationIds) {
      try {
        await db.$transaction(async (tx) => {
          const op = await tx.operation.findUnique({ where: { operationId: id } });
          if (!op) throw new Error("No encontrada");
          if (op.status !== "pending") throw new Error("Ya no está pendiente");

          if (op.type === "transfer_out" || op.type === "transfer_in") {
            // Confirmar par
            const refOps = await tx.operation.findMany({
              where: { reference: op.reference!, status: "pending" },
            });
            const out = refOps.find((o) => o.type === "transfer_out");
            const incoming = refOps.find((o) => o.type === "transfer_in");
            if (!out || !incoming) throw new Error("Par incompleto");
            const outR = await applyDelta(tx, out.accountId, -Number(out.amount));
            const inR = await applyDelta(tx, incoming.accountId, +Number(incoming.amount));
            await tx.operation.update({
              where: { operationId: out.operationId },
              data: { status: "confirmed", balanceAfter: outR.newBalance, confirmedAt: new Date(), confirmedById: userId ?? null },
            });
            await tx.operation.update({
              where: { operationId: incoming.operationId },
              data: { status: "confirmed", balanceAfter: inR.newBalance, confirmedAt: new Date(), confirmedById: userId ?? null },
            });
          } else {
            const amount = Number(op.amount);
            const delta =
              op.type === "deposit" ? amount : op.type === "withdrawal" ? -amount : amount;
            const r = await applyDelta(tx, op.accountId, delta, op.type === "adjustment");
            await tx.operation.update({
              where: { operationId: id },
              data: { status: "confirmed", balanceAfter: r.newBalance, confirmedAt: new Date(), confirmedById: userId ?? null },
            });
          }

          await createAuditLog(tx, {
            action: "update",
            entityType: "Operation",
            entityId: id,
            module: "envios",
            userId,
            oldValues: { status: "pending" },
            newValues: { status: "confirmed", bulk: true },
          });
        });
        confirmed++;
      } catch (e) {
        const msg = e instanceof BalanceError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Error";
        failed.push({ id, error: msg });
      }
    }

    revalidateAll();
    return { success: true, data: { confirmed, failed } };
  } catch (error) {
    console.error("bulkConfirmOperations:", error);
    return { success: false, error: "Error en confirmación masiva" };
  }
}
