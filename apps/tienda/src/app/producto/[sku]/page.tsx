import { notFound } from "next/navigation";
import { getCatalog, type CatalogResponse } from "@/lib/erp-client";
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

  const related = catalog.products
    .filter(
      (p) =>
        p.sku !== product.sku &&
        p.category != null &&
        p.category === product.category
    )
    .slice(0, 3);

  return (
    <ProductDetailClient
      product={product}
      related={related}
      currency={catalog.currency}
    />
  );
}
