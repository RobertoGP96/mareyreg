export const dynamic = "force-dynamic";

import { getProducts } from "@/modules/inventory/queries/product-queries";
import { ProductListClient } from "@/modules/inventory/components/product-list-client";

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold font-headline tracking-tight text-primary">Productos</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona los productos del inventario
        </p>
      </div>
      <ProductListClient products={products as Parameters<typeof ProductListClient>[0]["products"]} />
    </div>
  );
}
