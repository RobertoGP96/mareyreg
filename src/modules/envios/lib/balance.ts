// Optimistic-locking balance updates seguros para Neon serverless adapter.
// Reemplaza SELECT FOR UPDATE (no confiable en HTTP adapter) con
// UPDATE condicional por `version` y reintento corto.

import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";

export class BalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BalanceError";
  }
}
export class ConcurrencyError extends Error {
  constructor(message = "Conflicto de concurrencia, reintentar") {
    super(message);
    this.name = "ConcurrencyError";
  }
}

type Tx = Prisma.TransactionClient;

/**
 * Aplica `delta` (positivo = suma, negativo = resta) al balance de la cuenta.
 * - Lee balance + version, calcula nuevo balance.
 * - Rechaza saldo negativo a menos que `allowNegative=true` (para `adjustment`).
 * - Update condicional por version (optimistic locking). Reintenta hasta 3
 *   veces si la version cambió entre la lectura y el update.
 *
 * Devuelve el nuevo balance y la nueva version.
 */
export async function applyDelta(
  tx: Tx,
  accountId: number,
  delta: number,
  allowNegative = false
): Promise<{ newBalance: number; version: number }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const acc = await tx.account.findUniqueOrThrow({
      where: { accountId },
      select: { balance: true, version: true },
    });
    const currentBalance = Number(acc.balance);
    const newBalance = currentBalance + delta;
    if (!allowNegative && newBalance < 0) {
      throw new BalanceError("Saldo insuficiente");
    }
    const updated = await tx.account.updateMany({
      where: { accountId, version: acc.version },
      data: {
        balance: newBalance,
        version: { increment: 1 },
      },
    });
    if (updated.count === 1) {
      return { newBalance, version: acc.version + 1 };
    }
    // si llegamos aquí, otro proceso modificó la fila; reintentar con la lectura nueva
  }
  throw new ConcurrencyError();
}
