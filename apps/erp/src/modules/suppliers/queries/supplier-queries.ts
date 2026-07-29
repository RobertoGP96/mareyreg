import { db } from "@/lib/db";

export async function getSuppliers(includeInactive = false) {
  return db.supplier.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function getSupplier(id: number) {
  return db.supplier.findUnique({ where: { supplierId: id } });
}

export async function getActiveSuppliersForPicker() {
  return db.supplier.findMany({
    where: { isActive: true },
    select: { supplierId: true, name: true, taxId: true },
    orderBy: { name: "asc" },
  });
}
