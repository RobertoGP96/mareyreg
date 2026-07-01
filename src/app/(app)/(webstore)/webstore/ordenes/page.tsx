export const dynamic = "force-dynamic";

import { getOrderLogs, getWebstoreDashboardKpis } from "@/modules/webstore/queries/order-log-queries";
import { OrderInboxClient } from "@/modules/webstore/components/order-inbox-client";

export default async function WebstoreOrdersPage() {
  const [logsRaw, kpis] = await Promise.all([getOrderLogs(), getWebstoreDashboardKpis()]);

  const orders = logsRaw.map((o) => ({
    logId: o.logId,
    externalOrderId: o.externalOrderId,
    status: o.status,
    receivedAt: o.receivedAt.toISOString(),
    apiKeyLabel: o.apiKey.label,
    salesOrderFolio: o.salesOrder?.folio ?? null,
    invoiceFolio: o.invoice?.folio ?? null,
    invoiceTotal: o.invoice ? Number(o.invoice.total) : null,
  }));

  return (
    <div className="space-y-4">
      <OrderInboxClient orders={orders} kpis={kpis} />
    </div>
  );
}
