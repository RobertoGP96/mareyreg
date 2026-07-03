"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import {
  createExchangeRateSchema,
  updateExchangeRateSchema,
  deleteExchangeRateSchema,
  type CreateExchangeRateInput,
  type UpdateExchangeRateInput,
  type DeleteExchangeRateInput,
} from "../lib/schemas";

const AUTH_ERROR_MESSAGE = "Debes iniciar sesión para realizar esta acción.";
const FORBIDDEN_ERROR_MESSAGE = "No tienes permisos para realizar esta acción";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

function isForbiddenError(error: unknown): boolean {
  return error instanceof ForbiddenError;
}

const revalidateRates = () => {
  revalidatePath("/currency/tasas");
};

export async function createExchangeRate(
  input: CreateExchangeRateInput
): Promise<ActionResult<{ exchangeRateId: number }>> {
  try {
    const parsed = createExchangeRateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;

    const dup = await db.exchangeRate.findUnique({
      where: {
        baseCurrencyId_quoteCurrencyId: {
          baseCurrencyId: data.baseCurrencyId,
          quoteCurrencyId: data.quoteCurrencyId,
        },
      },
    });
    if (dup) {
      return { success: false, error: "Ya existe una tasa configurada para ese par de monedas." };
    }

    const userId = await requireCurrentUserId();
    await assertRole("admin");

    const created = await db.$transaction(async (tx) => {
      const rate = await tx.exchangeRate.create({
        data: {
          baseCurrencyId: data.baseCurrencyId,
          quoteCurrencyId: data.quoteCurrencyId,
          rate: data.rate,
          updatedBy: userId,
        },
      });
      await tx.exchangeRateHistory.create({
        data: {
          exchangeRateId: rate.exchangeRateId,
          oldRate: null,
          newRate: data.rate,
          changedBy: userId,
          note: data.note ?? null,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "ExchangeRate",
        entityId: rate.exchangeRateId,
        module: "currency",
        userId,
        newValues: data,
      });
      return rate;
    });

    revalidateRates();
    return { success: true, data: { exchangeRateId: created.exchangeRateId } };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    if (isForbiddenError(error)) return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    console.error("createExchangeRate:", error);
    return { success: false, error: "Error al crear la tasa de cambio" };
  }
}

export async function updateExchangeRate(
  input: UpdateExchangeRateInput
): Promise<ActionResult<void>> {
  try {
    const parsed = updateExchangeRateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { exchangeRateId, rate, expectedVersion, note } = parsed.data;

    const userId = await requireCurrentUserId();
    await assertRole("admin");

    await db.$transaction(async (tx) => {
      const prev = await tx.exchangeRate.findUnique({ where: { exchangeRateId } });
      if (!prev) throw new Error("Tasa no encontrada");

      const updated = await tx.exchangeRate.updateMany({
        where: { exchangeRateId, version: expectedVersion },
        data: { rate, version: { increment: 1 }, updatedBy: userId },
      });
      if (updated.count === 0) {
        throw new Error("La tasa fue modificada por otro usuario. Recarga la página.");
      }

      await tx.exchangeRateHistory.create({
        data: {
          exchangeRateId,
          oldRate: prev.rate,
          newRate: rate,
          changedBy: userId,
          note: note ?? null,
        },
      });

      await createAuditLog(tx, {
        action: "update",
        entityType: "ExchangeRate",
        entityId: exchangeRateId,
        module: "currency",
        userId,
        oldValues: { rate: prev.rate.toNumber(), version: prev.version },
        newValues: { rate },
      });
    });

    revalidateRates();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    if (isForbiddenError(error)) return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    const KNOWN_MESSAGES = new Set([
      "Tasa no encontrada",
      "La tasa fue modificada por otro usuario. Recarga la página.",
    ]);
    if (error instanceof Error && KNOWN_MESSAGES.has(error.message)) {
      return { success: false, error: error.message };
    }
    console.error("updateExchangeRate:", error);
    return { success: false, error: "Error al actualizar la tasa de cambio" };
  }
}

export async function deleteExchangeRate(
  input: DeleteExchangeRateInput
): Promise<ActionResult<void>> {
  try {
    const parsed = deleteExchangeRateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { exchangeRateId } = parsed.data;

    const historyCount = await db.exchangeRateHistory.count({ where: { exchangeRateId } });
    if (historyCount > 1) {
      return {
        success: false,
        error: "No se puede eliminar: esta tasa tiene historial de cambios. Consérvala para auditoría.",
      };
    }

    const userId = await requireCurrentUserId();
    await assertRole("admin");

    await db.$transaction(async (tx) => {
      const prev = await tx.exchangeRate.findUnique({ where: { exchangeRateId } });
      if (!prev) throw new Error("Tasa no encontrada");

      await tx.exchangeRateHistory.deleteMany({ where: { exchangeRateId } });
      await tx.exchangeRate.delete({ where: { exchangeRateId } });

      await createAuditLog(tx, {
        action: "delete",
        entityType: "ExchangeRate",
        entityId: exchangeRateId,
        module: "currency",
        userId,
        oldValues: { rate: prev.rate.toNumber() },
      });
    });

    revalidateRates();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    if (isForbiddenError(error)) return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    const KNOWN_MESSAGES = new Set(["Tasa no encontrada"]);
    if (error instanceof Error && KNOWN_MESSAGES.has(error.message)) {
      return { success: false, error: error.message };
    }
    console.error("deleteExchangeRate:", error);
    return { success: false, error: "Error al eliminar la tasa de cambio" };
  }
}
