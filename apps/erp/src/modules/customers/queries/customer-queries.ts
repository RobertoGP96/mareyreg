import { db } from "@/lib/db";

export async function getCustomers(includeInactive = false) {
  return db.customer.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: "asc" },
    include: { priceList: { select: { priceListId: true, name: true } } },
  });
}

export async function getCustomer(id: number) {
  return db.customer.findUnique({
    where: { customerId: id },
    include: { priceList: true },
  });
}

export async function getActiveCustomersForPicker() {
  return db.customer.findMany({
    where: { isActive: true },
    select: { customerId: true, name: true, taxId: true, customerType: true, currentBalance: true, creditLimit: true },
    orderBy: { name: "asc" },
  });
}
