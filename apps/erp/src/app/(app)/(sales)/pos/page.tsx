export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PosClient } from "@/modules/sales/components/pos-client";
import { PageHeader } from "@/components/ui/page-header";
import { getActiveCustomersForPicker } from "@/modules/customers/queries/customer-queries";

export default async function PosPage() {
  // Preferimos un almac\u00e9n tipo "store" (punto de venta f\u00edsico). Si no hay
  // ninguno configurado, caemos al primer almac\u00e9n activo (comportamiento
  // previo) para no bloquear el POS en instalaciones sin ese tipo definido.
  const warehouse =
    (await db.warehouse.findFirst({
      where: { isActive: true, locationType: "store" },
      select: { warehouseId: true, name: true },
      orderBy: { warehouseId: "asc" },
    })) ??
    (await db.warehouse.findFirst({
      where: { isActive: true },
      select: { warehouseId: true, name: true },
      orderBy: { warehouseId: "asc" },
    }));

  if (!warehouse) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">
          No hay almacenes activos. Crea uno en /warehouses para usar el POS.
        </p>
      </div>
    );
  }

  const [productsRaw, customers] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      select: {
        productId: true,
        name: true,
        sku: true,
        barcode: true,
        unit: true,
        salePrice: true,
        isService: true,
        stockLevels: {
          where: { warehouseId: warehouse.warehouseId },
          select: { currentQuantity: true },
        },
        presentations: {
          where: { isActive: true },
          select: {
            presentationId: true,
            name: true,
            factor: true,
            retailPrice: true,
            wholesalePrice: true,
            barcode: true,
            sku: true,
            isBase: true,
          },
          orderBy: [{ isBase: "desc" }, { sortOrder: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    }),
    getActiveCustomersForPicker(),
  ]);

  const products = productsRaw.map((p) => ({
    productId: p.productId,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    unit: p.unit,
    salePrice: p.salePrice != null ? Number(p.salePrice) : null,
    stock: p.isService ? 9999 : p.stockLevels[0] ? Number(p.stockLevels[0].currentQuantity) : 0,
    presentations: p.presentations.map((pr) => ({
      presentationId: pr.presentationId,
      name: pr.name,
      factor: Number(pr.factor),
      retailPrice: Number(pr.retailPrice),
      wholesalePrice: pr.wholesalePrice != null ? Number(pr.wholesalePrice) : null,
      barcode: pr.barcode,
      sku: pr.sku,
      isBase: pr.isBase,
    })),
  }));

  return (
    <div className="h-full">
      <PageHeader title="Punto de Venta" className="mb-3" />
      <PosClient
        products={products}
        customers={customers}
        warehouseId={warehouse.warehouseId}
        warehouseName={warehouse.name}
      />
    </div>
  );
}
