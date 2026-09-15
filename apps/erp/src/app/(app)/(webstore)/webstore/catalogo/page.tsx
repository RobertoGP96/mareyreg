export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { getWebstoreCatalogWithKpis } from "@/modules/webstore/queries/catalog-queries";
import { listModelGroups } from "@/modules/webstore/queries/model-group-queries";
import { WebstoreCatalogClient } from "@/modules/webstore/components/webstore-catalog-client";

export default async function WebstoreCatalogPage() {
  const [session, { rows, kpis }, groups] = await Promise.all([
    auth(),
    getWebstoreCatalogWithKpis(),
    listModelGroups(),
  ]);
  const isAdmin = session?.user?.role === "admin";
  const categories = Array.from(
    new Set(rows.map((r) => r.category).filter((c): c is string => Boolean(c)))
  ).sort();

  return (
    <div className="space-y-4">
      <WebstoreCatalogClient
        rows={rows}
        kpis={kpis}
        categories={categories}
        groups={groups}
        isAdmin={isAdmin}
      />
    </div>
  );
}
