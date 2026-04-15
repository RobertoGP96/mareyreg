export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { getKardex } from "@/modules/reporting/queries/kardex-queries";
import { KardexClient } from "@/modules/reporting/components/kardex-client";

interface Props {
  searchParams: Promise<{ productId?: string; warehouseId?: string }>;
}

export default async function KardexPage({ searchParams }: Props) {
  const sp = await searchParams;
  const productId = sp.productId ? Number(sp.productId) : null;
  const warehouseId = sp.warehouseId ? Number(sp.warehouseId) : undefined;

  const [products, warehouses, rows] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      select: { productId: true, name: true, unit: true },
      orderBy: { name: "asc" },
    }),
    db.warehouse.findMany({
      where: { isActive: true },
      select: { warehouseId: true, name: true },
      orderBy: { name: "asc" },
    }),
    productId ? getKardex(productId, { warehouseId }) : Promise.resolve([]),
  ]);

  const product = productId ? products.find((p) => p.productId === productId) : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kardex</h1>
        <p className="text-muted-foreground mt-1">
          Historico de movimientos y saldo acumulado por producto
        </p>
      </div>
      <KardexClient
        products={products}
        warehouses={warehouses}
        selectedProductId={productId}
        selectedWarehouseId={warehouseId ?? null}
        product={product ?? null}
        rows={rows}
      />
    </div>
  );
}
