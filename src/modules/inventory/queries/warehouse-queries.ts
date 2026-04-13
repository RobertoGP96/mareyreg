import { db } from "@/lib/db";

export async function getWarehouses() {
  return db.warehouse.findMany({ orderBy: { name: "asc" } });
}

export async function getWarehouse(id: number) {
  return db.warehouse.findUnique({ where: { warehouseId: id } });
}
