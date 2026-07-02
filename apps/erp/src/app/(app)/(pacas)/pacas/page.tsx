export const dynamic = "force-dynamic";

import { getPacaInventory, getPacaEntries } from "@/modules/pacas/queries/paca-queries";
import { getPacaCategories } from "@/modules/pacas/queries/paca-category-queries";
import { PacaListClient } from "@/modules/pacas/components/paca-list-client";

export default async function PacasPage() {
  const [inventoryRaw, entriesRaw, categories] = await Promise.all([
    getPacaInventory(),
    getPacaEntries(),
    getPacaCategories(),
  ]);

  const inventory = inventoryRaw.map((i) => ({
    ...i,
    totalCost: Number(i.totalCost),
  }));

  const entries = entriesRaw.map((e) => ({
    ...e,
    purchasePrice: e.purchasePrice == null ? null : Number(e.purchasePrice),
  }));

  return (
    <div className="space-y-4">
      <PacaListClient
        inventory={inventory as Parameters<typeof PacaListClient>[0]["inventory"]}
        entries={entries as Parameters<typeof PacaListClient>[0]["entries"]}
        categories={categories}
      />
    </div>
  );
}
