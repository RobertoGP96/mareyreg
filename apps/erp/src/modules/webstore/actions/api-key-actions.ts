"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import { generateRawKey, getKeyPrefix, WEBSTORE_API_KEY_SCOPES } from "../lib/api-key";

const FORBIDDEN_ERROR_MESSAGE = "No tienes permisos para realizar esta acción";

const createWebstoreApiKeyInputSchema = z.object({
  label: z.string().trim().min(1, "La etiqueta es requerida"),
  scopes: z
    .array(z.enum(WEBSTORE_API_KEY_SCOPES))
    .min(1, "Selecciona al menos un permiso")
    .default([...WEBSTORE_API_KEY_SCOPES]),
  expiresInDays: z.number().int().positive().nullable().optional().default(null),
});

export type CreateWebstoreApiKeyInput = z.input<typeof createWebstoreApiKeyInputSchema>;

export async function createWebstoreApiKey(
  input: CreateWebstoreApiKeyInput
): Promise<ActionResult<{ apiKeyId: number; rawKey: string }>> {
  try {
    const parsed = createWebstoreApiKeyInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { label, scopes, expiresInDays } = parsed.data;

    const userId = await requireCurrentUserId();
    await assertRole("admin");
    const rawKey = generateRawKey();
    const keyHash = await bcrypt.hash(rawKey, 10);
    const keyPrefix = getKeyPrefix(rawKey);
    const expiresAt =
      expiresInDays != null ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

    const apiKey = await db.$transaction(async (tx) => {
      const k = await tx.webstoreApiKey.create({
        data: { label, keyHash, keyPrefix, scopes, expiresAt, createdBy: userId },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "WebstoreApiKey",
        entityId: k.apiKeyId,
        module: "webstore",
        userId,
        newValues: { label, scopes, expiresAt },
      });
      return k;
    });

    revalidatePath("/webstore/api-keys");
    return { success: true, data: { apiKeyId: apiKey.apiKeyId, rawKey } };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    console.error("Error creating webstore API key:", error);
    return { success: false, error: "Error al crear la API key" };
  }
}

export async function revokeWebstoreApiKey(apiKeyId: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin");
    await db.$transaction(async (tx) => {
      await tx.webstoreApiKey.update({
        where: { apiKeyId },
        data: { isActive: false, revokedAt: new Date() },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "WebstoreApiKey",
        entityId: apiKeyId,
        module: "webstore",
        userId,
        newValues: { isActive: false },
      });
    });
    revalidatePath("/webstore/api-keys");
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    console.error("Error revoking webstore API key:", error);
    return { success: false, error: "Error al revocar la API key" };
  }
}
