export const dynamic = "force-dynamic";

import { getStockLevels, getStockMovements } from "@/modules/inventory/queries/stock-queries";
import { getProducts } from "@/modules/inventory/queries/product-queries";
import { getWarehouses } from "@/modules/inventory/queries/warehouse-queries";
import { StockPageClient } from "@/modules/inventory/components/stock-page-client";

export default async function StockPage() {
  const [stockLevels, movements, products, warehouses] = await Promise.all([
    getStockLevels(),
    getStockMovements(),
    getProducts(),
    getWarehouses(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold font-headline tracking-tight text-primary">Stock</h1>
        <p className="text-muted-foreground mt-1">
          Niveles de stock y movimientos
        </p>
      </div>
      <StockPageClient
        stockLevels={stockLevels as Parameters<typeof StockPageClient>[0]["stockLevels"]}
        movements={movements as Parameters<typeof StockPageClient>[0]["movements"]}
        products={products}
        warehouses={warehouses}
      />
    </div>
  );
}
