import { getProducts, type WebstoreProduct } from "@/lib/erp-client";
import { CatalogError } from "@/components/catalog-error";
import { CatalogClient } from "./catalog-client";

export const dynamic = "force-dynamic";

interface CatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  let products: WebstoreProduct[];
  try {
    products = await getProducts();
  } catch (e) {
    console.error("CatalogPage getProducts:", e);
    return <CatalogError retryHref="/catalogo" />;
  }
  return (
    <CatalogClient
      products={products}
      initialCategory={firstValue(params.cat)}
      initialQuery={firstValue(params.q)}
      autoFocus={firstValue(params.focus) === "1"}
      initialOfertas={firstValue(params.ofertas) === "1"}
    />
  );
}
