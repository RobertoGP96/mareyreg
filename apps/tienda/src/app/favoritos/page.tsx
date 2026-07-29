import { getCatalog, type CatalogResponse } from "@/lib/erp-client";
import { CatalogError } from "@/components/catalog-error";
import { FavoritesClient } from "./favorites-client";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  let catalog: CatalogResponse;
  try {
    catalog = await getCatalog();
  } catch (e) {
    console.error("FavoritesPage getCatalog:", e);
    return <CatalogError retryHref="/favoritos" />;
  }
  return (
    <FavoritesClient products={catalog.products} currency={catalog.currency} />
  );
}
