import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { Prisma } from "@/generated/prisma";
import { normalizePhone } from "./normalize-phone";
import type { WebstoreCustomerUpsertInput } from "./schemas";

type PrismaTx = Prisma.TransactionClient;

export interface WebstoreCustomerAttribution {
  apiKeyId: number;
}

export interface WebstoreCustomerUpsertResult {
  customerId: number;
  created: boolean;
}

/** Nombre del índice único parcial creado en `prisma/sql/webstore-customers.sql`. */
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

async function writeUpsertAudit(
  tx: PrismaTx,
  input: {
    action: "create" | "update";
    customerId: number;
    payload: WebstoreCustomerUpsertInput;
    apiKeyId: number;
  }
): Promise<void> {
  await createAuditLog(tx, {
    action: input.action,
    entityType: "Customer",
    entityId: input.customerId,
    module: "webstore",
    userId: null,
    newValues: { ...input.payload, apiKeyId: input.apiKeyId },
  });
}

async function upsertWithinTx(
  tx: PrismaTx,
  payload: WebstoreCustomerUpsertInput,
  attribution: WebstoreCustomerAttribution
): Promise<WebstoreCustomerUpsertResult> {
  const normalizedPhone = normalizePhone(payload.phone);

  if (normalizedPhone) {
    const byPhone = await tx.customer.findFirst({
      where: { source: "webstore", normalizedPhone },
    });
    if (byPhone) {
      await tx.customer.update({
        where: { customerId: byPhone.customerId },
        data: {
          name: payload.name,
          phone: payload.phone,
          normalizedPhone,
          email: payload.email ?? byPhone.email ?? undefined,
          address: payload.address ?? byPhone.address ?? undefined,
          version: { increment: 1 },
        },
      });
      await writeUpsertAudit(tx, {
        action: "update",
        customerId: byPhone.customerId,
        payload,
        apiKeyId: attribution.apiKeyId,
      });
      return { customerId: byPhone.customerId, created: false };
    }
  }

  if (payload.email) {
    const byEmail = await tx.customer.findFirst({ where: { email: payload.email } });
    if (byEmail) {
      await tx.customer.update({
        where: { customerId: byEmail.customerId },
        data: {
          name: payload.name,
          phone: payload.phone,
          normalizedPhone,
          source: "webstore",
          address: payload.address ?? byEmail.address ?? undefined,
          version: { increment: 1 },
        },
      });
      await writeUpsertAudit(tx, {
        action: "update",
        customerId: byEmail.customerId,
        payload,
        apiKeyId: attribution.apiKeyId,
      });
      return { customerId: byEmail.customerId, created: false };
    }
  }

  const created = await tx.customer.create({
    data: {
      name: payload.name,
      phone: payload.phone,
      normalizedPhone,
      email: payload.email ?? null,
      address: payload.address ?? null,
      source: "webstore",
      customerType: "retail",
    },
  });
  await writeUpsertAudit(tx, {
    action: "create",
    customerId: created.customerId,
    payload,
    apiKeyId: attribution.apiKeyId,
  });
  return { customerId: created.customerId, created: true };
}

/**
 * Registra o actualiza un cliente de la tienda en línea. Prioridad de
 * matching: teléfono normalizado (fuente webstore) -> email -> crear nuevo.
 * Ante una carrera de inserción concurrente sobre el índice único parcial
 * `customers_webstore_phone_unique`, reintenta resolviendo por teléfono
 * (ya debe existir la fila creada por la otra transacción).
 */
export async function upsertWebstoreCustomer(
  payload: WebstoreCustomerUpsertInput,
  attribution: WebstoreCustomerAttribution
): Promise<WebstoreCustomerUpsertResult> {
  try {
    return await db.$transaction((tx) => upsertWithinTx(tx, payload, attribution));
  } catch (error) {
    if (!isWebstorePhoneConflict(error)) throw error;

    const normalizedPhone = normalizePhone(payload.phone);
    return db.$transaction(async (tx) => {
      const existing = normalizedPhone
        ? await tx.customer.findFirst({ where: { source: "webstore", normalizedPhone } })
        : null;
      if (!existing) throw error;

      await tx.customer.update({
        where: { customerId: existing.customerId },
        data: {
          name: payload.name,
          phone: payload.phone,
          normalizedPhone,
          email: payload.email ?? existing.email ?? undefined,
          address: payload.address ?? existing.address ?? undefined,
          version: { increment: 1 },
        },
      });
      await writeUpsertAudit(tx, {
        action: "update",
        customerId: existing.customerId,
        payload,
        apiKeyId: attribution.apiKeyId,
      });
      return { customerId: existing.customerId, created: false };
    });
  }
}
