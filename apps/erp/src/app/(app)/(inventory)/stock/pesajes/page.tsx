export const dynamic = "force-dynamic";

import { getProductsForStock } from "@/modules/inventory/queries/stock-queries";
import { getWarehouses } from "@/modules/inventory/queries/warehouse-queries";
import { PieceRegistrationClient } from "@/modules/inventory/components/piece-registration-client";

export default async function PieceRegistrationPage() {
  const [products, warehouses] = await Promise.all([
    getProductsForStock(),
    getWarehouses(),
  ]);

  return (
    <div className="space-y-4">
      <PieceRegistrationClient
        products={products
          .filter((p) => p.isCatchWeight)
          .map((p) => ({
            productId: p.productId,
            name: p.name,
            unit: p.unit,
            presentations: p.presentations.map((pr) => ({
              presentationId: pr.presentationId,
              name: pr.name,
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
