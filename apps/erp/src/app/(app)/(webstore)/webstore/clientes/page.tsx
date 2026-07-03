export const dynamic = "force-dynamic";

import { listWebstoreCustomers, getWebstoreCustomerKpis } from "@/modules/webstore/queries/customer-queries";
import { CustomerListClient } from "@/modules/webstore/components/customer-list-client";

export default async function WebstoreCustomersPage() {
  const [customersRaw, kpis] = await Promise.all([
    listWebstoreCustomers(),
    getWebstoreCustomerKpis(),
  ]);

  const customers = customersRaw.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    lastOrderAt: c.lastOrderAt ? c.lastOrderAt.toISOString() : null,
  }));

  return (
    <div className="space-y-4">
      <CustomerListClient customers={customers} kpis={kpis} />
    </div>
  );
}
