export const dynamic = "force-dynamic";

import { getPacaCategories } from "@/modules/pacas/queries/paca-category-queries";
import { PacaCategoryManager } from "@/modules/pacas/components/paca-category-manager";

export default async function PacaCategoriasPage() {
  const categories = await getPacaCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Categorias de Pacas</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona las categorias de pacas de ropa
        </p>
      </div>
      <PacaCategoryManager categories={categories} />
    </div>
  );
}
