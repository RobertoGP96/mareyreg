"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { applyDelta, BalanceError, ConcurrencyError } from "../lib/balance";
import {
  RateNotConfiguredError,
  RateOverlapError,
  RateOverrideDeviationError,
  assertRateOverrideWithinBounds,
  resolveAccountConversion,
  type ConversionDirection,
} from "../lib/exchange-rate";
import type { Prisma } from "@/generated/prisma";
import { transferSchema, type TransferInput } from "../lib/schemas";

const AUTH_ERROR_MESSAGE = "Debes iniciar sesión para realizar esta acción.";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

type Tx = Prisma.TransactionClient | typeof db;

/**
 * Resuelve la tasa aplicable a una transferencia entre dos cuentas delegando
 * en `resolveAccountConversion`: las reglas asignadas a la cuenta origen
 * (`fromAccountId`) determinan la tasa entre `fromCurrencyId` (tratada como
 * "moneda externa" de entrada) y `toCurrencyId` (tratada como "moneda de
 * cuenta" de salida). Esto reutiliza bounds inclusivos/exclusivos y detección
 * de solape de `lib/exchange-rate.ts` en vez de duplicar la lógica con
 * semántica propia.
 */
async function resolveTransferRate(
  client: Tx,
  args: {
    fromAccountId: number;
    fromCurrencyId: number;
    toCurrencyId: number;
    amount: number;
  },
) {
  const resolved = await resolveAccountConversion(client, {
    accountId: args.fromAccountId,
    accountCurrencyId: args.toCurrencyId,
    externalCurrencyId: args.fromCurrencyId,
    externalAmount: args.amount,
  });
  return {
    rate: resolved.rate,
    ruleId: resolved.ruleId,
    ruleName: resolved.ruleName,
    minAmount: resolved.minAmount,
    maxAmount: resolved.maxAmount,
    direction: resolved.direction,
  };
}

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
        include: { currency: true },
      }),
      db.account.findUnique({
        where: { accountId: input.toAccountId },
        include: { currency: true },
      }),
    ]);
    if (!from || !to) return { success: false, error: "Cuenta no encontrada" };

    const resolved = await resolveTransferRate(db, {
      fromAccountId: from.accountId,
      fromCurrencyId: from.currencyId,
      toCurrencyId: to.currencyId,
      amount: input.amount,
    });
    const amountTo =
      resolved.direction === "base_to_quote"
        ? input.amount * resolved.rate
        : input.amount / resolved.rate;

    return {
      success: true,
      data: {
        rate: resolved.rate,
        rangeMin: resolved.minAmount,
        rangeMax: resolved.maxAmount,
        amountTo,
        direction: resolved.direction,
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
    const userId = await requireCurrentUserId();
    const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();
    const status = data.status ?? "confirmed";
    const reference = generateReference();

    const result = await db.$transaction(async (tx) => {
      const from = await tx.account.findUniqueOrThrow({
        where: { accountId: data.fromAccountId },
        include: { currency: true },
      });
      const to = await tx.account.findUniqueOrThrow({
        where: { accountId: data.toAccountId },
        include: { currency: true },
      });
      if (!from.active) throw new Error("La cuenta origen está inactiva");
      if (!to.active) throw new Error("La cuenta destino está inactiva");

      let resolved: Awaited<ReturnType<typeof resolveTransferRate>> | null = null;
      try {
        resolved = await resolveTransferRate(tx, {
          fromAccountId: from.accountId,
          fromCurrencyId: from.currencyId,
          toCurrencyId: to.currencyId,
          amount: data.amount,
        });
      } catch (e) {
        if (e instanceof RateNotConfiguredError && data.rateOverride) {
          resolved = null;
        } else {
          throw e;
        }
      }

      let rateOverrideUnbounded = false;
      if (data.rateOverride && resolved) {
        assertRateOverrideWithinBounds(data.rateOverride, resolved.rate);
      } else if (data.rateOverride && !resolved) {
        rateOverrideUnbounded = true;
      }

      const ruleId = resolved?.ruleId ?? null;
      const direction: ConversionDirection = resolved?.direction ?? "base_to_quote";
      const rate = data.rateOverride ?? resolved?.rate;
      if (rate === undefined) {
        throw new RateNotConfiguredError({
          accountId: from.accountId,
          baseCurrencyId: from.currencyId,
          quoteCurrencyId: to.currencyId,
          amount: data.amount,
          message: "La cuenta origen no tiene reglas para convertir entre estas monedas",
        });
      }
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
          exchangeRateRuleId: ruleId,
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
          exchangeRateRuleId: ruleId,
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
          ...(rateOverrideUnbounded ? { rateOverrideUnbounded: true } : {}),
        },
      });

      return { reference, outId: outOp.operationId, inId: inOp.operationId, rate, amountTo };
    });

    revalidateAll();
    return { success: true, data: result };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    if (error instanceof BalanceError) return { success: false, error: error.message };
    if (error instanceof ConcurrencyError) return { success: false, error: "Conflicto de concurrencia, reintenta" };
    if (error instanceof RateNotConfiguredError) return { success: false, error: error.message };
    if (error instanceof RateOverlapError) return { success: false, error: error.message };
    if (error instanceof RateOverrideDeviationError) return { success: false, error: error.message };
    const KNOWN_MESSAGES = new Set(["La cuenta origen está inactiva", "La cuenta destino está inactiva"]);
    const msg =
      error instanceof Error && KNOWN_MESSAGES.has(error.message)
        ? error.message
        : "Error al crear la transferencia";
    if (msg === "Error al crear la transferencia") console.error("createTransfer:", error);
    return { success: false, error: msg };
  }
}

export async function confirmTransfer(
  reference: string
): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
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
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    if (error instanceof BalanceError) return { success: false, error: error.message };
    if (error instanceof ConcurrencyError) return { success: false, error: "Conflicto de concurrencia, reintenta" };
    const KNOWN_MESSAGES = new Set(["Pareja de transferencia no encontrada o ya confirmada"]);
    const msg =
      error instanceof Error && KNOWN_MESSAGES.has(error.message)
        ? error.message
        : "Error al confirmar la transferencia";
    if (msg === "Error al confirmar la transferencia") console.error("confirmTransfer:", error);
    return { success: false, error: msg };
  }
}

export async function cancelTransfer(reference: string): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
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
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    const KNOWN_MESSAGES = new Set(["Transferencia no encontrada o ya procesada"]);
    const msg =
      error instanceof Error && KNOWN_MESSAGES.has(error.message)
        ? error.message
        : "Error al cancelar la transferencia";
    if (msg === "Error al cancelar la transferencia") console.error("cancelTransfer:", error);
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
    const userId = await requireCurrentUserId();
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
        const KNOWN_MESSAGES = new Set([
          "No encontrada",
          "Ya no está pendiente",
          "Par incompleto",
        ]);
        const msg =
          e instanceof BalanceError
            ? e.message
            : e instanceof Error && KNOWN_MESSAGES.has(e.message)
              ? e.message
              : "Error al confirmar";
        if (msg === "Error al confirmar") console.error(`bulkConfirmOperations[${id}]:`, e);
        failed.push({ id, error: msg });
      }
    }

    revalidateAll();
    return { success: true, data: { confirmed, failed } };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("bulkConfirmOperations:", error);
    return { success: false, error: "Error en confirmación masiva" };
  }
}
