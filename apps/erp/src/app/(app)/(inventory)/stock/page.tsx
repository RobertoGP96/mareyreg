export const dynamic = "force-dynamic";

import {
  getStockLevels,
  getStockMovements,
  getProductsForStock,
} from "@/modules/inventory/queries/stock-queries";
import { getWarehouses } from "@/modules/inventory/queries/warehouse-queries";
import { StockPageClient } from "@/modules/inventory/components/stock-page-client";

export default async function StockPage() {
  const [stockLevels, movements, products, warehouses] = await Promise.all([
    getStockLevels(),
    getStockMovements(),
    getProductsForStock(),
    getWarehouses(),
  ]);

  const stockLevelsSerialized = stockLevels.map((sl) => ({
    productId: sl.productId,
    warehouseId: sl.warehouseId,
    currentQuantity: Number(sl.currentQuantity),
    currentPieces: sl.currentPieces,
    product: {
      name: sl.product.name,
      unit: sl.product.unit,
      minStock: Number(sl.product.minStock),
      maxStock: sl.product.maxStock != null ? Number(sl.product.maxStock) : null,
      costPrice: sl.product.costPrice != null ? Number(sl.product.costPrice) : null,
      isCatchWeight: sl.product.isCatchWeight,
      largestPresentation:
        sl.product.presentations.length > 0
          ? {
              name: sl.product.presentations[0].name,
              factor: Number(sl.product.presentations[0].factor),
              piecesPerUnit: sl.product.presentations[0].piecesPerUnit,
            }
          : null,
    },
    warehouse: { name: sl.warehouse.name },
  }));

  const movementsSerialized = movements.map((m) => ({
    movementId: m.movementId,
    quantity: Number(m.quantity),
    pieces: m.pieces,
    movementType: m.movementType,
    unitCost: m.unitCost != null ? Number(m.unitCost) : null,
    referenceDoc: m.referenceDoc,
    notes: m.notes,
    createdAt: m.createdAt.toISOString(),
    product: { name: m.product.name, unit: m.product.unit, isCatchWeight: m.product.isCatchWeight },
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
          isCatchWeight: p.isCatchWeight,
          presentations: p.presentations.map((pr) => ({
            presentationId: pr.presentationId,
            name: pr.name,
            factor: Number(pr.factor),
            isBase: pr.isBase,
            piecesPerUnit: pr.piecesPerUnit,
          })),
        }))}
        warehouses={warehouses.map((w) => ({
          warehouseId: w.warehouseId,
          name: w.name,
        }))}
      />
    </div>
  );
}
