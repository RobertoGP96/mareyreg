export const dynamic = "force-dynamic";

import { getWebstoreApiKeys } from "@/modules/webstore/queries/api-key-queries";
import { ApiKeyListClient } from "@/modules/webstore/components/api-key-list-client";

export default async function WebstoreApiKeysPage() {
  const apiKeys = await getWebstoreApiKeys();

  const serialized = apiKeys.map((k) => ({
    apiKeyId: k.apiKeyId,
    label: k.label,
    keyPrefix: k.keyPrefix,
    scopes: k.scopes,
    expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
    isActive: k.isActive,
    revokedAt: k.revokedAt ? k.revokedAt.toISOString() : null,
    lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
    createdAt: k.createdAt.toISOString(),
    createdByName: k.creator?.fullName ?? null,
  }));

  return (
    <div className="space-y-4">
      <ApiKeyListClient apiKeys={serialized} />
    </div>
  );
}
