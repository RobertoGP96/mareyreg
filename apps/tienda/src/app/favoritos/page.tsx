import { getProducts, type WebstoreProduct } from "@/lib/erp-client";
import { CatalogError } from "@/components/catalog-error";
import { FavoritesClient } from "./favorites-client";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  let products: WebstoreProduct[];
  try {
    products = await getProducts();
  } catch (e) {
    console.error("FavoritesPage getProducts:", e);
    return <CatalogError retryHref="/favoritos" />;
  }
  return <FavoritesClient products={products} />;
}
