import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";

const KEY_PREFIX_LENGTH = 12;

export function generateRawKey(): string {
  return `wsk_${randomBytes(24).toString("base64url")}`;
}

export function getKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, KEY_PREFIX_LENGTH);
}

/**
 * Resuelve una API key cruda contra las activas en DB. No hay índice directo
 * sobre el secreto (está hasheado); se filtra primero por prefijo (indexado
 * indirectamente vía isActive + pocas filas esperadas) y se compara con bcrypt.
 */
export async function resolveApiKey(rawKey: string): Promise<{ apiKeyId: number } | null> {
  const prefix = getKeyPrefix(rawKey);
  const candidates = await db.webstoreApiKey.findMany({
    where: { keyPrefix: prefix, isActive: true },
  });
  for (const candidate of candidates) {
    if (await bcrypt.compare(rawKey, candidate.keyHash)) {
      await db.webstoreApiKey.update({
        where: { apiKeyId: candidate.apiKeyId },
        data: { lastUsedAt: new Date() },
      });
      return { apiKeyId: candidate.apiKeyId };
    }
  }
  return null;
}
