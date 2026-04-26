export const dynamic = "force-dynamic";

import { getProducts } from "@/modules/inventory/queries/product-queries";
import { ProductListClient } from "@/modules/inventory/components/product-list-client";

export default async function ProductsPage() {
  const products = await getProducts();

  const serialized = products.map((p) => ({
    productId: p.productId,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    category: p.category,
    unit: p.unit,
    minStock: Number(p.minStock),
    maxStock: p.maxStock != null ? Number(p.maxStock) : null,
    costPrice: p.costPrice != null ? Number(p.costPrice) : null,
    brand: p.brand,
    supplier: p.supplier,
    supplierRef: p.supplierRef,
    isActive: p.isActive,
    description: p.description,
    notes: p.notes,
  }));

  return (
    <div className="space-y-4">
      <ProductListClient products={serialized} />
    </div>
  );
}
