import { db } from "@/lib/db";

export async function getWebstoreApiKeys() {
  return db.webstoreApiKey.findMany({
    select: {
      apiKeyId: true,
      label: true,
      keyPrefix: true,
      isActive: true,
      revokedAt: true,
      lastUsedAt: true,
      createdAt: true,
      creator: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
