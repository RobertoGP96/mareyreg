"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import { Prisma } from "@/generated/prisma";
import { normalizePhone } from "../lib/normalize-phone";
import {
  webstoreCustomerUpdateSchema,
  type WebstoreCustomerUpdateInput,
} from "../lib/customer-schemas";

const FORBIDDEN_ERROR_MESSAGE = "No tienes permisos para realizar esta acción";
const WEBSTORE_PHONE_UNIQUE_INDEX = "customers_webstore_phone_unique";

function isWebstorePhoneConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  if (typeof target === "string") return target.includes(WEBSTORE_PHONE_UNIQUE_INDEX);
  if (Array.isArray(target)) return (target as string[]).includes("normalized_phone");
  return false;
}

export async function updateWebstoreCustomer(
  customerId: number,
  input: WebstoreCustomerUpdateInput
): Promise<ActionResult<void>> {
  try {
    const parsed = webstoreCustomerUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;

    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");

    await db.$transaction(async (tx) => {
      const prev = await tx.customer.findFirst({ where: { customerId, source: "webstore" } });
      if (!prev) throw new Error("NOT_FOUND");

      const normalizedPhone = data.phone ? normalizePhone(data.phone) : null;

      const res = await tx.customer.updateMany({
        where: { customerId, version: data.version },
        data: {
          name: data.name,
          phone: data.phone ?? null,
          normalizedPhone,
          email: data.email ? data.email : null,
          address: data.address ?? null,
          version: { increment: 1 },
        },
      });
      if (res.count === 0) throw new Error("STALE_VERSION");

      await createAuditLog(tx, {
        action: "update",
        entityType: "Customer",
        entityId: customerId,
        module: "webstore",
        userId,
        oldValues: prev,
        newValues: data,
      });
    });

    revalidatePath("/webstore/clientes");
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { success: false, error: "El cliente no existe" };
    }
    if (error instanceof Error && error.message === "STALE_VERSION") {
      return {
        success: false,
        error: "El cliente fue modificado por otra persona. Recarga e intenta de nuevo.",
      };
    }
    if (isWebstorePhoneConflict(error)) {
      return {
        success: false,
        error: "Ya existe un cliente de la tienda con ese teléfono",
      };
    }
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    console.error("Error updating webstore customer:", error);
    return { success: false, error: "Error al actualizar el cliente" };
  }
}

export async function toggleWebstoreCustomerActive(
  customerId: number,
  isActive: boolean
): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");

    await db.$transaction(async (tx) => {
      const prev = await tx.customer.findFirst({ where: { customerId, source: "webstore" } });
      if (!prev) throw new Error("NOT_FOUND");

      await tx.customer.update({
        where: { customerId },
        data: { isActive, version: { increment: 1 } },
      });

      await createAuditLog(tx, {
        action: "update",
        entityType: "Customer",
        entityId: customerId,
        module: "webstore",
        userId,
        oldValues: { isActive: prev.isActive },
        newValues: { isActive },
      });
    });

    revalidatePath("/webstore/clientes");
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { success: false, error: "El cliente no existe" };
    }
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    console.error("Error toggling webstore customer active:", error);
    return { success: false, error: "Error al cambiar el estado del cliente" };
  }
}
