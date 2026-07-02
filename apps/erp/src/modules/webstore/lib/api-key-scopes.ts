/** Scopes válidos para una API key de la tienda en línea. */
export const WEBSTORE_API_KEY_SCOPES = ["read_catalog", "create_orders"] as const;
export type WebstoreApiKeyScope = (typeof WEBSTORE_API_KEY_SCOPES)[number];

export function isWebstoreApiKeyScope(value: unknown): value is WebstoreApiKeyScope {
  return WEBSTORE_API_KEY_SCOPES.includes(value as WebstoreApiKeyScope);
}
