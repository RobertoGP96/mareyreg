import { notFound } from "next/navigation";
import { getCatalog, type CatalogResponse } from "@/lib/erp-client";
import { entryHasCategory, groupCatalog, modelSiblings } from "@/lib/model-groups";
import { CatalogError } from "@/components/catalog-error";
import { ProductDetailClient } from "./product-detail-client";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ sku: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { sku } = await params;
  const decodedSku = decodeURIComponent(sku);

  let catalog: CatalogResponse;
  try {
    catalog = await getCatalog();
  } catch (e) {
    console.error("ProductPage getCatalog:", e);
    return <CatalogError retryHref="/catalogo" />;
  }

  const product = catalog.products.find((p) => p.sku === decodedSku);
  if (!product) notFound();

  const models = modelSiblings(catalog.products, product);
  const ownSkus = new Set(models.map((m) => m.sku));

  // Sugerencias por entrada (grupo o producto suelto) de la misma categoría,
  // sin la propia familia; el carrusel vuelve a agrupar los modelos.
  const related =
    product.category != null
      ? groupCatalog(catalog.products)
          .filter(
            (entry) =>
              !entry.models.some((m) => ownSkus.has(m.sku)) &&
              entryHasCategory(entry, product.category as string)
          )
          .slice(0, 3)
          .flatMap((entry) => entry.models)
      : [];

  return (
    <ProductDetailClient
      product={product}
      models={models}
      related={related}
      currency={catalog.currency}
    />
  );
}
