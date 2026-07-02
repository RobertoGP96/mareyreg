export const dynamic = "force-dynamic";

import { getSales, getSalesStats } from "@/modules/pacas/queries/paca-sale-queries";
import { SaleListClient } from "@/modules/pacas/components/sale-list-client";
import { db } from "@/lib/db";

export default async function VentasPage() {
  const [sales, stats, categoriesWithInventory] = await Promise.all([
    getSales(),
    getSalesStats(),
    db.pacaCategory.findMany({
      include: { inventory: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const availableCategories = categoriesWithInventory
    .filter((c) => (c.inventory?.available ?? 0) > 0)
    .map((c) => ({
      categoryId: c.categoryId,
      name: c.name,
      available: c.inventory!.available,
    }));

  return (
    <div className="space-y-4">
      <SaleListClient
        sales={sales}
        availableCategories={availableCategories}
        stats={stats}
      />
    </div>
  );
}
