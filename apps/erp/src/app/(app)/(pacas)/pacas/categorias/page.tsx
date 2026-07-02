export const dynamic = "force-dynamic";

import { getPacaCategories } from "@/modules/pacas/queries/paca-category-queries";
import { getClassifications } from "@/modules/pacas/queries/paca-availability-queries";
import { PacaCategoryManager } from "@/modules/pacas/components/paca-category-manager";

export default async function PacaCategoriasPage() {
  const [categories, classifications] = await Promise.all([
    getPacaCategories(),
    getClassifications(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold font-headline tracking-tight text-foreground">
          Categorias de Pacas
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Gestiona las categorias de pacas de ropa
        </p>
      </div>
      <PacaCategoryManager
        categories={categories as Parameters<typeof PacaCategoryManager>[0]["categories"]}
        classifications={classifications}
      />
    </div>
  );
}
