import { db } from "@/lib/db";

export async function getWarehouses(includeInactive = false) {
  return db.warehouse.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function getWarehouse(id: number) {
  return db.warehouse.findUnique({ where: { warehouseId: id } });
}
