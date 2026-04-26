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

  const stockLevelsSerialized = stockLevels.map((sl) => ({
    productId: sl.productId,
    warehouseId: sl.warehouseId,
    currentQuantity: Number(sl.currentQuantity),
    product: {
      name: sl.product.name,
      unit: sl.product.unit,
      minStock: Number(sl.product.minStock),
      maxStock: sl.product.maxStock != null ? Number(sl.product.maxStock) : null,
      costPrice: sl.product.costPrice != null ? Number(sl.product.costPrice) : null,
    },
    warehouse: { name: sl.warehouse.name },
  }));

  const movementsSerialized = movements.map((m) => ({
    movementId: m.movementId,
    quantity: Number(m.quantity),
    movementType: m.movementType,
    unitCost: m.unitCost != null ? Number(m.unitCost) : null,
    referenceDoc: m.referenceDoc,
    notes: m.notes,
    createdAt: m.createdAt.toISOString(),
    product: { name: m.product.name, unit: m.product.unit },
    warehouse: { name: m.warehouse.name },
  }));

  return (
    <div className="space-y-4">
      <StockPageClient
        stockLevels={stockLevelsSerialized}
        movements={movementsSerialized}
        products={products.map((p) => ({
          productId: p.productId,
          name: p.name,
          unit: p.unit,
        }))}
        warehouses={warehouses.map((w) => ({
          warehouseId: w.warehouseId,
          name: w.name,
        }))}
      />
    </div>
  );
}
