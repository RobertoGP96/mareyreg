import { db } from "@/lib/db";

export async function getPacaInventory() {
  return db.pacaInventory.findMany({
    include: {
      category: {
        include: { classification: true },
      },
    },
    orderBy: { category: { name: "asc" } },
  });
}

export async function getPacaEntries() {
  return db.pacaEntry.findMany({
    include: { category: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getPacaInventoryStats() {
  const result = await db.pacaInventory.aggregate({
    _sum: {
      available: true,
      reserved: true,
      sold: true,
    },
  });

  const available = result._sum.available ?? 0;
  const reserved = result._sum.reserved ?? 0;
  const sold = result._sum.sold ?? 0;

  return {
    total: available + reserved + sold,
    available,
    reserved,
    sold,
  };
}
