export const dynamic = "force-dynamic";

import { getPacas } from "@/modules/pacas/queries/paca-queries";
import { getPacaCategories } from "@/modules/pacas/queries/paca-category-queries";
import { PacaListClient } from "@/modules/pacas/components/paca-list-client";
import { db } from "@/lib/db";

export default async function PacasPage() {
  const [pacas, categories, warehouses] = await Promise.all([
    getPacas(),
    getPacaCategories(),
    db.warehouse.findMany({ select: { warehouseId: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pacas de Ropa</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona las pacas de ropa reciclada
        </p>
      </div>
      <PacaListClient
        initialPacas={pacas as Parameters<typeof PacaListClient>[0]["initialPacas"]}
        categories={categories}
        warehouses={warehouses}
      />
    </div>
  );
}
