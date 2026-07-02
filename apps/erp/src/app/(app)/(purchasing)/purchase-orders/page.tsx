export const dynamic = "force-dynamic";

import { getPurchaseOrders } from "@/modules/purchasing/queries/purchase-queries";
import { getActiveSuppliersForPicker } from "@/modules/suppliers/queries/supplier-queries";
import { PurchaseOrderListClient } from "@/modules/purchasing/components/purchase-order-list-client";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";

export default async function PurchaseOrdersPage() {
  const [orders, suppliers, warehouses, products] = await Promise.all([
    getPurchaseOrders(),
    getActiveSuppliersForPicker(),
    db.warehouse.findMany({
      where: { isActive: true },
      select: { warehouseId: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.product.findMany({
      where: { isActive: true, isService: false },
      select: {
        productId: true,
        name: true,
        unit: true,
        costPrice: true,
        presentations: {
          where: { isActive: true },
          select: { presentationId: true, name: true, factor: true, isBase: true },
          orderBy: [{ isBase: "desc" }, { sortOrder: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const productsForClient = products.map((p) => ({
    ...p,
    costPrice: p.costPrice != null ? Number(p.costPrice) : null,
    presentations: p.presentations.map((pr) => ({
      presentationId: pr.presentationId,
      name: pr.name,
      factor: Number(pr.factor),
      isBase: pr.isBase,
    })),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ordenes de Compra"
        description="Gestiona tus pedidos a proveedores y recepciones de mercancia"
      />
      <PurchaseOrderListClient
        orders={orders as Parameters<typeof PurchaseOrderListClient>[0]["orders"]}
        suppliers={suppliers}
        warehouses={warehouses}
        products={productsForClient}
      />
    </div>
  );
}
