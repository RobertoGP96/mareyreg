import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";

const KEY_PREFIX_LENGTH = 12;

/** Scopes válidos para una API key de la tienda en línea. */
export const WEBSTORE_API_KEY_SCOPES = ["read_catalog", "create_orders"] as const;
export type WebstoreApiKeyScope = (typeof WEBSTORE_API_KEY_SCOPES)[number];

export function isWebstoreApiKeyScope(value: unknown): value is WebstoreApiKeyScope {
  return WEBSTORE_API_KEY_SCOPES.includes(value as WebstoreApiKeyScope);
}

export function generateRawKey(): string {
  return `wsk_${randomBytes(24).toString("base64url")}`;
}

export function getKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, KEY_PREFIX_LENGTH);
}

export interface ResolvedApiKey {
  apiKeyId: number;
  scopes: WebstoreApiKeyScope[];
}

/**
 * Resuelve una API key cruda contra las activas en DB. No hay índice directo
 * sobre el secreto (está hasheado); se filtra primero por prefijo (indexado
 * indirectamente vía isActive + pocas filas esperadas) y se compara con bcrypt.
 * Las keys expiradas (`expiresAt` en el pasado) se tratan como inválidas aunque
 * sigan `isActive`, sin revocarlas automáticamente.
 */
export async function resolveApiKey(rawKey: string): Promise<ResolvedApiKey | null> {
  const prefix = getKeyPrefix(rawKey);
  const candidates = await db.webstoreApiKey.findMany({
    where: { keyPrefix: prefix, isActive: true },
  });
  const now = new Date();
  for (const candidate of candidates) {
    if (await bcrypt.compare(rawKey, candidate.keyHash)) {
      if (candidate.expiresAt != null && candidate.expiresAt < now) {
        return null;
      }
      await db.webstoreApiKey.update({
        where: { apiKeyId: candidate.apiKeyId },
        data: { lastUsedAt: new Date() },
      });
      return {
        apiKeyId: candidate.apiKeyId,
        scopes: candidate.scopes.filter(isWebstoreApiKeyScope),
      };
    }
  }
  return null;
}
