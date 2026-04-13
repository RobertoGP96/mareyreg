export const dynamic = "force-dynamic";

import { getWarehouses } from "@/modules/inventory/queries/warehouse-queries";
import { WarehouseListClient } from "@/modules/inventory/components/warehouse-list-client";

export default async function WarehousesPage() {
  const warehouses = await getWarehouses();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold font-headline tracking-tight text-primary">Almacenes</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona los almacenes del inventario
        </p>
      </div>
      <WarehouseListClient warehouses={warehouses as Parameters<typeof WarehouseListClient>[0]["warehouses"]} />
    </div>
  );
}
