"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";
import { applyDelta, BalanceError, ConcurrencyError } from "../lib/balance";
import {
  operationSchema,
  conversionOperationSchema,
  batchOperationsSchema,
  type OperationInput,
  type ConversionOperationInput,
  type ConversionDirection,
  type DepositWithConversionInput,
  type BatchRowInput,
} from "../lib/schemas";
import {
  resolveAccountConversion,
  RateNotConfiguredError,
} from "../lib/exchange-rate";

const revalidateAll = () => {
  revalidatePath("/envios/operaciones");
  revalidatePath("/envios/pendientes");
  revalidatePath("/envios/cuentas");
  revalidatePath("/envios/grupos");
  revalidatePath("/envios/dashboard");
};

function deltaFor(type: "deposit" | "withdrawal" | "adjustment", amount: number) {
  if (type === "deposit") return Math.abs(amount);
  if (type === "withdrawal") return -Math.abs(amount);
  return amount; // adjustment respeta el signo entrante
}

export async function createOperation(
  input: OperationInput
): Promise<ActionResult<{ operationId: number }>> {
  try {
    const parsed = operationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;
    if (data.type !== "adjustment" && data.amount <= 0) {
      return { success: false, error: "Monto debe ser mayor que cero" };
    }

    const account = await db.account.findUnique({
      where: { accountId: data.accountId },
      select: { accountId: true, currencyId: true, active: true },
    });
    if (!account) return { success: false, error: "Cuenta no encontrada" };
    if (!account.active) return { success: false, error: "La cuenta está inactiva" };

    const userId = await getCurrentUserId();
    const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();
    const status = data.status ?? "confirmed";

    const created = await db.$transaction(async (tx) => {
      let balanceAfter: number;
      if (status === "confirmed") {
        const delta = deltaFor(data.type, data.amount);
        const result = await applyDelta(tx, data.accountId, delta, data.type === "adjustment");
        balanceAfter = result.newBalance;
      } else {
        const acc = await tx.account.findUniqueOrThrow({
          where: { accountId: data.accountId },
          select: { balance: true },
        });
        balanceAfter = Number(acc.balance);
      }

      const op = await tx.operation.create({
        data: {
          accountId: data.accountId,
          currencyId: account.currencyId,
          type: data.type,
          status,
          amount: Math.abs(data.amount),
          description: data.description?.trim() || null,
          reference: data.reference?.trim() || null,
          balanceAfter,
          occurredAt,
          confirmedAt: status === "confirmed" ? new Date() : null,
          createdById: userId ?? null,
          confirmedById: status === "confirmed" ? userId ?? null : null,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "Operation",
        entityId: op.operationId,
        module: "envios",
        userId,
        newValues: { ...data, status },
      });
      return op;
    });

    revalidateAll();
    return { success: true, data: { operationId: created.operationId } };
  } catch (error) {
    if (error instanceof BalanceError) {
      return { success: false, error: error.message };
    }
    if (error instanceof ConcurrencyError) {
      return { success: false, error: "Conflicto de concurrencia, intenta nuevamente" };
    }
    console.error("createOperation:", error);
    return { success: false, error: "Error al registrar la operación" };
  }
}

export async function confirmOperation(
  operationId: number
): Promise<ActionResult<{ balanceAfter: number }>> {
  try {
    const userId = await getCurrentUserId();
    const result = await db.$transaction(async (tx) => {
      const op = await tx.operation.findUnique({ where: { operationId } });
      if (!op) throw new Error("Operación no encontrada");
      if (op.status !== "pending") throw new Error("Solo operaciones pendientes pueden confirmarse");
      if (op.type === "transfer_in" || op.type === "transfer_out") {
        throw new Error("Usa confirmTransfer para pares de transferencia");
      }

      const amount = Number(op.amount);
      const delta = deltaFor(op.type as "deposit" | "withdrawal" | "adjustment", amount);
      const { newBalance } = await applyDelta(
        tx,
        op.accountId,
        delta,
        op.type === "adjustment"
      );

      await tx.operation.update({
        where: { operationId },
        data: {
          status: "confirmed",
          balanceAfter: newBalance,
          confirmedAt: new Date(),
          confirmedById: userId ?? null,
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Operation",
        entityId: operationId,
        module: "envios",
        userId,
        oldValues: { status: "pending" },
        newValues: { status: "confirmed", balanceAfter: newBalance },
      });
      return newBalance;
    });

    revalidateAll();
    return { success: true, data: { balanceAfter: result } };
  } catch (error) {
    if (error instanceof BalanceError) return { success: false, error: error.message };
    if (error instanceof ConcurrencyError) return { success: false, error: "Conflicto de concurrencia, reintenta" };
    const msg = error instanceof Error ? error.message : "Error al confirmar";
    console.error("confirmOperation:", error);
    return { success: false, error: msg };
  }
}

export async function createOperationsBatch(
  inputs: BatchRowInput[]
): Promise<
  ActionResult<{ created: number[] }>
> {
  try {
    const parsed = batchOperationsSchema.safeParse(inputs);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const rows = parsed.data;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.kind === "regular" && r.type !== "adjustment" && r.amount <= 0) {
        return { success: false, error: `Fila ${i + 1}: el monto debe ser mayor que cero` };
      }
    }

    const userId = await getCurrentUserId();

    const created = await db.$transaction(async (tx) => {
      const ids: number[] = [];
      for (let i = 0; i < rows.length; i++) {
        const data = rows[i];
        const account = await tx.account.findUnique({
          where: { accountId: data.accountId },
        });
        if (!account) throw new Error(`Fila ${i + 1}: cuenta no encontrada`);
        if (!account.active) throw new Error(`Fila ${i + 1}: la cuenta está inactiva`);

        const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();
        const status = data.status ?? "confirmed";

        let opId: number;

        if (data.kind === "regular") {
          let balanceAfter: number;
          if (status === "confirmed") {
            const delta = deltaFor(data.type, data.amount);
            try {
              const r = await applyDelta(tx, data.accountId, delta, data.type === "adjustment");
              balanceAfter = r.newBalance;
            } catch (e) {
              if (e instanceof BalanceError) throw new Error(`Fila ${i + 1}: ${e.message}`);
              throw e;
            }
          } else {
            balanceAfter = Number(account.balance);
          }

          const op = await tx.operation.create({
            data: {
              accountId: data.accountId,
              currencyId: account.currencyId,
              type: data.type,
              status,
              amount: Math.abs(data.amount),
              description: data.description?.trim() || null,
              reference: data.reference?.trim() || null,
              balanceAfter,
              occurredAt,
              confirmedAt: status === "confirmed" ? new Date() : null,
              createdById: userId ?? null,
              confirmedById: status === "confirmed" ? userId ?? null : null,
            },
          });
          opId = op.operationId;
        } else {
          // kind === "conversion"
          if (data.externalCurrencyId === account.currencyId) {
            throw new Error(`Fila ${i + 1}: la moneda externa debe ser distinta a la moneda de la cuenta`);
          }

          let rate: number;
          let ruleId: number;
          let amountInAccountCurrency: number;

          try {
            const resolved = await resolveAccountConversion(tx, {
              accountId: data.accountId,
              accountCurrencyId: account.currencyId,
              externalCurrencyId: data.externalCurrencyId,
              externalAmount: data.externalAmount,
            });
            ruleId = resolved.ruleId;
            rate = data.rateOverride ?? resolved.rate;
            amountInAccountCurrency =
              resolved.direction === "base_to_quote"
                ? data.externalAmount * rate
                : data.externalAmount / rate;
          } catch (e) {
            if (e instanceof RateNotConfiguredError) {
              throw new Error(`Fila ${i + 1}: ${e.message}`);
            }
            throw e;
          }

          const isCredit = data.direction === "credit";
          const delta = isCredit ? +amountInAccountCurrency : -amountInAccountCurrency;
          const opType = isCredit ? "deposit" : "withdrawal";

          let balanceAfter: number;
          if (status === "confirmed") {
            try {
              const r = await applyDelta(tx, data.accountId, delta);
              balanceAfter = r.newBalance;
            } catch (e) {
              if (e instanceof BalanceError) throw new Error(`Fila ${i + 1}: ${e.message}`);
              throw e;
            }
          } else {
            balanceAfter = Number(account.balance);
          }

          const op = await tx.operation.create({
            data: {
              accountId: data.accountId,
              currencyId: account.currencyId,
              type: opType,
              status,
              amount: amountInAccountCurrency,
              description: data.description?.trim() || null,
              reference: data.reference?.trim() || null,
              balanceAfter,
              exchangeRateRuleId: ruleId,
              rateApplied: rate,
              counterAmount: data.externalAmount,
              counterCurrencyId: data.externalCurrencyId,
              occurredAt,
              confirmedAt: status === "confirmed" ? new Date() : null,
              createdById: userId ?? null,
              confirmedById: status === "confirmed" ? userId ?? null : null,
            },
          });
          opId = op.operationId;
        }

        await createAuditLog(tx, {
          action: "create",
          entityType: "Operation",
          entityId: opId,
          module: "envios",
          userId,
          newValues: { ...data, status, batch: true, batchIndex: i },
        });

        ids.push(opId);
      }
      return ids;
    });

    revalidateAll();
    return { success: true, data: { created } };
  } catch (error) {
    if (error instanceof BalanceError) return { success: false, error: error.message };
    if (error instanceof ConcurrencyError) {
      return { success: false, error: "Conflicto de concurrencia, reintenta" };
    }
    if (error instanceof RateNotConfiguredError) return { success: false, error: error.message };
    const msg = error instanceof Error ? error.message : "Error al registrar el lote";
    console.error("createOperationsBatch:", error);
    return { success: false, error: msg };
  }
}

type ConversionPreview = {
  rate: number;
  rangeMin: number;
  rangeMax: number | null;
  amountInAccountCurrency: number;
  direction: "base_to_quote" | "quote_to_base";
  accountCurrencyCode: string;
  externalCurrencyCode: string;
  ruleId: number;
  ruleName: string;
};

export async function previewDepositConversion(input: {
  accountId: number;
  externalCurrencyId: number;
  externalAmount: number;
}): Promise<ActionResult<ConversionPreview>> {
  try {
    if (!input.externalAmount || input.externalAmount <= 0) {
      return { success: false, error: "Monto inválido" };
    }
    const account = await db.account.findUnique({
      where: { accountId: input.accountId },
      include: { currency: true },
    });
    if (!account) return { success: false, error: "Cuenta no encontrada" };
    if (input.externalCurrencyId === account.currencyId) {
      return {
        success: false,
        error: "La moneda externa debe ser distinta a la moneda de la cuenta",
      };
    }

    const resolved = await resolveAccountConversion(db, {
      accountId: input.accountId,
      accountCurrencyId: account.currencyId,
      externalCurrencyId: input.externalCurrencyId,
      externalAmount: input.externalAmount,
    });

    const externalCurrencyCode =
      resolved.direction === "base_to_quote"
        ? resolved.baseCurrencyCode
        : resolved.quoteCurrencyCode;

    return {
      success: true,
      data: {
        rate: resolved.rate,
        rangeMin: resolved.minAmount,
        rangeMax: resolved.maxAmount,
        amountInAccountCurrency: resolved.amountInAccountCurrency,
        direction: resolved.direction,
        accountCurrencyCode: account.currency.code,
        externalCurrencyCode,
        ruleId: resolved.ruleId,
        ruleName: resolved.ruleName,
      },
    };
  } catch (error) {
    if (error instanceof RateNotConfiguredError) {
      return { success: false, error: error.message };
    }
    console.error("previewDepositConversion:", error);
    return { success: false, error: "Error al calcular la conversión" };
  }
}

export async function createConversionOperation(
  input: ConversionOperationInput
): Promise<
  ActionResult<{
    operationId: number;
    rate: number;
    amountInAccountCurrency: number;
    direction: ConversionDirection;
  }>
> {
  try {
    const parsed = conversionOperationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;
    const userId = await getCurrentUserId();
    const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();
    const status = data.status ?? "confirmed";
    const isCredit = data.direction === "credit";

    const result = await db.$transaction(async (tx) => {
      const account = await tx.account.findUniqueOrThrow({
        where: { accountId: data.accountId },
        include: { currency: true },
      });
      if (!account.active) throw new Error("La cuenta está inactiva");
      if (data.externalCurrencyId === account.currencyId) {
        throw new Error("La moneda externa debe ser distinta a la moneda de la cuenta");
      }

      const resolved = await resolveAccountConversion(tx, {
        accountId: account.accountId,
        accountCurrencyId: account.currencyId,
        externalCurrencyId: data.externalCurrencyId,
        externalAmount: data.externalAmount,
      });
      const ruleId = resolved.ruleId;
      const ruleDirection = resolved.direction;
      const rate = data.rateOverride ?? resolved.rate;
      const amountInAccountCurrency =
        ruleDirection === "base_to_quote"
          ? data.externalAmount * rate
          : data.externalAmount / rate;

      const delta = isCredit ? +amountInAccountCurrency : -amountInAccountCurrency;
      const opType = isCredit ? "deposit" : "withdrawal";

      let balanceAfter: number;
      if (status === "confirmed") {
        const r = await applyDelta(tx, account.accountId, delta);
        balanceAfter = r.newBalance;
      } else {
        balanceAfter = Number(account.balance);
      }

      const op = await tx.operation.create({
        data: {
          accountId: account.accountId,
          currencyId: account.currencyId,
          type: opType,
          status,
          amount: amountInAccountCurrency,
          description: data.description?.trim() || null,
          reference: data.reference?.trim() || null,
          balanceAfter,
          exchangeRateRuleId: ruleId,
          rateApplied: rate,
          counterAmount: data.externalAmount,
          counterCurrencyId: data.externalCurrencyId,
          occurredAt,
          confirmedAt: status === "confirmed" ? new Date() : null,
          createdById: userId ?? null,
          confirmedById: status === "confirmed" ? userId ?? null : null,
        },
      });

      await createAuditLog(tx, {
        action: "create",
        entityType: "Operation",
        entityId: op.operationId,
        module: "envios",
        userId,
        newValues: {
          ...data,
          rate,
          amountInAccountCurrency,
          ruleDirection,
          ruleId,
          status,
          variant: isCredit ? "conversion_credit" : "conversion_debit",
        },
      });

      return { operationId: op.operationId, rate, amountInAccountCurrency };
    });

    revalidateAll();
    return { success: true, data: { ...result, direction: data.direction } };
  } catch (error) {
    if (error instanceof BalanceError) return { success: false, error: error.message };
    if (error instanceof ConcurrencyError) {
      return { success: false, error: "Conflicto de concurrencia, reintenta" };
    }
    if (error instanceof RateNotConfiguredError) {
      return { success: false, error: error.message };
    }
    const msg = error instanceof Error ? error.message : "Error al registrar la conversión";
    console.error("createConversionOperation:", error);
    return { success: false, error: msg };
  }
}

export async function createDepositWithConversion(
  input: Omit<DepositWithConversionInput, "direction"> & { direction?: ConversionDirection }
) {
  return createConversionOperation({ ...input, direction: input.direction ?? "credit" });
}

export async function cancelOperation(operationId: number): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const op = await tx.operation.findUnique({ where: { operationId } });
      if (!op) throw new Error("Operación no encontrada");
      if (op.status !== "pending") throw new Error("Solo se pueden cancelar pendientes");
      await tx.operation.update({
        where: { operationId },
        data: {
          status: "cancelled",
          confirmedAt: null,
          confirmedById: null,
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Operation",
        entityId: operationId,
        module: "envios",
        userId,
        oldValues: { status: "pending" },
        newValues: { status: "cancelled" },
      });
    });
    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al cancelar";
    console.error("cancelOperation:", error);
    return { success: false, error: msg };
  }
}
