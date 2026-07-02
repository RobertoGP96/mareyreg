import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";

import {
  WEBSTORE_API_KEY_SCOPES,
  isWebstoreApiKeyScope,
  type WebstoreApiKeyScope,
} from "./api-key-scopes";

export { WEBSTORE_API_KEY_SCOPES, isWebstoreApiKeyScope, type WebstoreApiKeyScope };

const KEY_PREFIX_LENGTH = 12;

/** Umbral de throttle para el refresco de lastUsedAt (ver resolveApiKey). */
const LAST_USED_AT_THROTTLE_MS = 60 * 60 * 1000;

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
 *
 * `lastUsedAt` se refresca con throttle (1h): en vez de escribir en cada
 * request autenticada (hot path), solo se escribe si el valor ya cargado es
 * null o tiene más de 1h de antigüedad. La comparación es en memoria contra
 * el valor leído en este mismo request, así que `lastUsedAt` pasa a ser
 * "última vez usada, con hasta 1h de rezago" en vez de exacto — aceptable
 * porque es un campo informativo, no usado para lógica de negocio ni expiración.
 * La condición `lastUsedAt: candidate.lastUsedAt` en el `updateMany` evita que
 * dos requests concurrentes pisen el timestamp más nuevo con uno más viejo.
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
      const isStale =
        candidate.lastUsedAt == null ||
        now.getTime() - candidate.lastUsedAt.getTime() > LAST_USED_AT_THROTTLE_MS;
      if (isStale) {
        await db.webstoreApiKey.updateMany({
          where: { apiKeyId: candidate.apiKeyId, lastUsedAt: candidate.lastUsedAt },
          data: { lastUsedAt: now },
        });
      }
      return {
        apiKeyId: candidate.apiKeyId,
        scopes: candidate.scopes.filter(isWebstoreApiKeyScope),
      };
    }
  }
  return null;
}
