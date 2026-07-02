export const dynamic = "force-dynamic";

import { getWarehouses } from "@/modules/inventory/queries/warehouse-queries";
import { WarehouseListClient } from "@/modules/inventory/components/warehouse-list-client";

export default async function WarehousesPage() {
  const warehouses = await getWarehouses();

  const serialized = warehouses.map((w) => ({
    warehouseId: w.warehouseId,
    name: w.name,
    location: w.location,
    province: w.province,
    capacity: w.capacity != null ? Number(w.capacity) : null,
    warehouseType: w.warehouseType,
    contactPhone: w.contactPhone,
    isActive: w.isActive,
  }));

  return (
    <div className="space-y-4">
      <WarehouseListClient warehouses={serialized} />
    </div>
  );
}
