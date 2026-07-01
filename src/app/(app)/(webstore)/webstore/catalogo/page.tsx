export const dynamic = "force-dynamic";

import { getWebstoreCatalog, getWebstoreCatalogKpis } from "@/modules/webstore/queries/catalog-queries";
import { WebstoreCatalogClient } from "@/modules/webstore/components/webstore-catalog-client";

export default async function WebstoreCatalogPage() {
  const [rows, kpis] = await Promise.all([getWebstoreCatalog(), getWebstoreCatalogKpis()]);
  const categories = Array.from(
    new Set(rows.map((r) => r.category).filter((c): c is string => Boolean(c)))
  ).sort();

  return (
    <div className="space-y-4">
      <WebstoreCatalogClient rows={rows} kpis={kpis} categories={categories} />
    </div>
  );
}
