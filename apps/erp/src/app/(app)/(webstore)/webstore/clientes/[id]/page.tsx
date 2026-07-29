export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getWebstoreCustomerDetail } from "@/modules/webstore/queries/customer-queries";
import { CustomerDetailClient } from "@/modules/webstore/components/customer-detail-client";

export default async function WebstoreCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customerId = Number(id);
  const customer = await getWebstoreCustomerDetail(customerId);
  if (!customer) notFound();

  return (
    <div className="space-y-4">
      <CustomerDetailClient
        customer={{
          ...customer,
          createdAt: customer.createdAt.toISOString(),
          orders: customer.orders.map((o) => ({
            ...o,
            orderDate: o.orderDate.toISOString(),
          })),
        }}
      />
    </div>
  );
}
