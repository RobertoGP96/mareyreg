"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";
import { applyDelta, BalanceError, ConcurrencyError } from "../lib/balance";
import { operationSchema, type OperationInput } from "../lib/schemas";

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
