export const dynamic = "force-dynamic";

import { getPacaInventory, getPacaEntries } from "@/modules/pacas/queries/paca-queries";
import { getPacaCategories } from "@/modules/pacas/queries/paca-category-queries";
import { PacaListClient } from "@/modules/pacas/components/paca-list-client";

export default async function PacasPage() {
  const [inventory, entries, categories] = await Promise.all([
    getPacaInventory(),
    getPacaEntries(),
    getPacaCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold font-headline tracking-tight text-primary">Inventario de Pacas</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona las entradas y cantidades de pacas por categoria
        </p>
      </div>
      <PacaListClient
        inventory={inventory as Parameters<typeof PacaListClient>[0]["inventory"]}
        entries={entries as Parameters<typeof PacaListClient>[0]["entries"]}
        categories={categories}
      />
    </div>
  );
}
