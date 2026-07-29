import { getCatalog, type CatalogResponse } from "@/lib/erp-client";
import { CatalogError } from "@/components/catalog-error";
import { HomeClient } from "./home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let catalog: CatalogResponse;
  try {
    catalog = await getCatalog();
  } catch (e) {
    console.error("HomePage getCatalog:", e);
    return <CatalogError retryHref="/" />;
  }
  return <HomeClient products={catalog.products} currency={catalog.currency} />;
}
