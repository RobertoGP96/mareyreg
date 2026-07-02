export const dynamic = "force-dynamic";

import { getProducts } from "@/modules/inventory/queries/product-queries";
import { ProductListClient } from "@/modules/inventory/components/product-list-client";
import { auth } from "@/lib/auth";

export default async function ProductsPage() {
  const [session, products] = await Promise.all([auth(), getProducts()]);
  const isAdmin = session?.user?.role === "admin";

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
    salePrice: p.salePrice != null ? Number(p.salePrice) : null,
    webstoreEnabled: p.webstoreEnabled,
    imageUrl: p.imageUrl,
    brand: p.brand,
    supplier: p.supplier,
    supplierRef: p.supplierRef,
    isActive: p.isActive,
    description: p.description,
    notes: p.notes,
  }));

  return (
    <div className="space-y-4">
      <ProductListClient products={serialized} isAdmin={isAdmin} />
    </div>
  );
}
