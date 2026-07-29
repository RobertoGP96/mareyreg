export const dynamic = "force-dynamic";

import { getProducts } from "@/modules/inventory/queries/product-queries";
import { getProductCurrencyContext } from "@/modules/inventory/queries/currency-context";
import { ProductListClient } from "@/modules/inventory/components/product-list-client";
import { auth } from "@/lib/auth";
import { roundToCurrency } from "@/lib/currency";

export default async function ProductsPage() {
  const [session, products, currencyCtx] = await Promise.all([
    auth(),
    getProducts(),
    getProductCurrencyContext(),
  ]);
  const isAdmin = session?.user?.role === "admin";

  const serialized = products.map((p) => {
    const salePrice = p.salePrice != null ? Number(p.salePrice) : null;
    // Equivalente CUP calculado en el server con la tasa vigente — el
    // cliente nunca convierte con tasas propias.
    const rate = p.saleCurrencyId != null ? currencyCtx.ratesByCurrencyId[p.saleCurrencyId] : null;
    const salePriceBase =
      salePrice != null && p.saleCurrencyId != null && rate != null
        ? roundToCurrency(salePrice * rate, currencyCtx.baseDecimalPlaces)
        : null;

    return {
      productId: p.productId,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      category: p.category,
      unit: p.unit,
      minStock: Number(p.minStock),
      maxStock: p.maxStock != null ? Number(p.maxStock) : null,
      costPrice: p.costPrice != null ? Number(p.costPrice) : null,
      salePrice,
      saleCurrencyId: p.saleCurrencyId,
      salePriceBase,
      webstoreEnabled: p.webstoreEnabled,
      imageUrl: p.imageUrl,
      brand: p.brand,
      supplier: p.supplier,
      supplierRef: p.supplierRef,
      isActive: p.isActive,
      description: p.description,
      notes: p.notes,
      allowNegative: p.allowNegative,
      isCatchWeight: p.isCatchWeight,
    };
  });

  return (
    <div className="space-y-4">
      <ProductListClient
        products={serialized}
        isAdmin={isAdmin}
        currencies={currencyCtx.options}
        baseCurrencyId={currencyCtx.baseCurrencyId}
        baseCode={currencyCtx.baseCode}
      />
    </div>
  );
}
