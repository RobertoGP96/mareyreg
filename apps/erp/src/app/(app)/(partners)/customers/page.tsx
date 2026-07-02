export const dynamic = "force-dynamic";

import { getCustomers } from "@/modules/customers/queries/customer-queries";
import { CustomerListClient } from "@/modules/customers/components/customer-list-client";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";

export default async function CustomersPage() {
  const [customers, priceLists] = await Promise.all([
    getCustomers(true),
    db.priceList.findMany({
      where: { isActive: true },
      select: { priceListId: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clientes"
        description="Gestiona tus clientes, limites de credito y listas de precios"
      />
      <CustomerListClient
        customers={customers as Parameters<typeof CustomerListClient>[0]["customers"]}
        priceLists={priceLists}
      />
    </div>
  );
}
