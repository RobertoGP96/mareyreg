"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { currencyDenominationSchema, type CurrencyDenominationInput } from "../lib/schemas";

const AUTH_ERROR_MESSAGE = "Debes iniciar sesión para realizar esta acción.";
const DUPLICATE_MESSAGE = "Ya existe esa denominación para la moneda";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

const revalidateDenominations = () => {
  revalidatePath("/envios/monedas");
  revalidatePath("/envios/entregas");
};

export async function createCurrencyDenomination(
  input: CurrencyDenominationInput
): Promise<ActionResult<{ denominationId: number }>> {
  try {
    const parsed = currencyDenominationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;
    const userId = await requireCurrentUserId();

    const created = await db.$transaction(async (tx) => {
      const currency = await tx.currency.findUnique({
        where: { currencyId: data.currencyId },
        select: { currencyId: true, code: true, kind: true },
      });
      if (!currency) throw new Error("Moneda no encontrada");
      if (currency.kind === "digital") {
        throw new Error(`${currency.code} es digital: no lleva denominaciones`);
      }

      const denomination = await tx.currencyDenomination.create({
        data: {
          currencyId: data.currencyId,
          value: data.value.toString(),
          label: data.label?.trim() || null,
          sortOrder: data.sortOrder,
          active: data.active ?? true,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "CurrencyDenomination",
        entityId: denomination.denominationId,
        module: "envios",
        userId,
        newValues: data,
      });
      return denomination;
    });

    revalidateDenominations();
    return { success: true, data: { denominationId: created.denominationId } };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    if (isUniqueViolation(error)) return { success: false, error: DUPLICATE_MESSAGE };
    console.error("createCurrencyDenomination:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al crear la denominación",
    };
  }
}

export async function updateCurrencyDenomination(
  id: number,
  input: CurrencyDenominationInput
): Promise<ActionResult<void>> {
  try {
    const parsed = currencyDenominationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;
    const userId = await requireCurrentUserId();

    await db.$transaction(async (tx) => {
      const prev = await tx.currencyDenomination.findUnique({ where: { denominationId: id } });
      if (!prev) throw new Error("Denominación no encontrada");

      // El desglose guarda un snapshot de unit_value y un trigger exige que
      // coincida con el catálogo, así que cambiar el valor rompería entregas
      // existentes.
      if (!prev.value.equals(data.value.toString())) {
        const used = await tx.cashDeliveryLineDenomination.count({
          where: { denominationId: id },
        });
        if (used > 0) {
          throw new Error(
            "No se puede cambiar el valor: la denominación ya se usó en entregas. Desactívala y crea una nueva."
          );
        }
      }

      await tx.currencyDenomination.update({
        where: { denominationId: id },
        data: {
          value: data.value.toString(),
          label: data.label?.trim() || null,
          sortOrder: data.sortOrder,
          ...(data.active !== undefined && { active: data.active }),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "CurrencyDenomination",
        entityId: id,
        module: "envios",
        userId,
        oldValues: prev,
        newValues: data,
      });
    });

    revalidateDenominations();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    if (isUniqueViolation(error)) return { success: false, error: DUPLICATE_MESSAGE };
    console.error("updateCurrencyDenomination:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar la denominación",
    };
  }
}

export async function toggleCurrencyDenominationActive(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.currencyDenomination.findUnique({ where: { denominationId: id } });
      if (!prev) throw new Error("Denominación no encontrada");

      await tx.currencyDenomination.update({
        where: { denominationId: id },
        data: { active: !prev.active },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "CurrencyDenomination",
        entityId: id,
        module: "envios",
        userId,
        oldValues: { active: prev.active },
        newValues: { active: !prev.active },
      });
    });
    revalidateDenominations();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("toggleCurrencyDenominationActive:", error);
    return { success: false, error: "Error al cambiar el estado de la denominación" };
  }
}

export async function deleteCurrencyDenomination(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.currencyDenomination.findUnique({ where: { denominationId: id } });
      if (!prev) throw new Error("Denominación no encontrada");

      const used = await tx.cashDeliveryLineDenomination.count({ where: { denominationId: id } });
      if (used > 0) {
        throw new Error(
          "La denominación ya se usó en entregas. Desactívala en lugar de eliminarla."
        );
      }

      await tx.currencyDenomination.delete({ where: { denominationId: id } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "CurrencyDenomination",
        entityId: id,
        module: "envios",
        userId,
        oldValues: prev,
      });
    });
    revalidateDenominations();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("deleteCurrencyDenomination:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al eliminar la denominación",
    };
  }
}
