"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";
import { generateRawKey, getKeyPrefix } from "../lib/api-key";

export async function createWebstoreApiKey(
  label: string
): Promise<ActionResult<{ apiKeyId: number; rawKey: string }>> {
  try {
    if (!label.trim()) return { success: false, error: "La etiqueta es requerida" };

    const userId = await getCurrentUserId();
    const rawKey = generateRawKey();
    const keyHash = await bcrypt.hash(rawKey, 10);
    const keyPrefix = getKeyPrefix(rawKey);

    const apiKey = await db.$transaction(async (tx) => {
      const k = await tx.webstoreApiKey.create({
        data: { label: label.trim(), keyHash, keyPrefix, createdBy: userId },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "WebstoreApiKey",
        entityId: k.apiKeyId,
        module: "webstore",
        userId,
        newValues: { label: label.trim() },
      });
      return k;
    });

    revalidatePath("/webstore/api-keys");
    return { success: true, data: { apiKeyId: apiKey.apiKeyId, rawKey } };
  } catch (error) {
    console.error("Error creating webstore API key:", error);
    return { success: false, error: "Error al crear la API key" };
  }
}

export async function revokeWebstoreApiKey(apiKeyId: number): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
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
    console.error("Error revoking webstore API key:", error);
    return { success: false, error: "Error al revocar la API key" };
  }
}
