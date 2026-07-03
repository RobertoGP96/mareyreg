import { notFound } from "next/navigation";
import { getProducts, type WebstoreProduct } from "@/lib/erp-client";
import { CatalogError } from "@/components/catalog-error";
import { ProductDetailClient } from "./product-detail-client";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ sku: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { sku } = await params;
  const decodedSku = decodeURIComponent(sku);

  let products: WebstoreProduct[];
  try {
    products = await getProducts();
  } catch (e) {
    console.error("ProductPage getProducts:", e);
    return <CatalogError retryHref="/catalogo" />;
  }

  const product = products.find((p) => p.sku === decodedSku);
  if (!product) notFound();

  const related = products
    .filter(
      (p) =>
        p.sku !== product.sku &&
        p.category != null &&
        p.category === product.category
    )
    .slice(0, 3);

  return <ProductDetailClient product={product} related={related} />;
}
