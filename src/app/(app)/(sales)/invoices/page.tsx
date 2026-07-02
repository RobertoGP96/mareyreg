export const dynamic = "force-dynamic";

import { getInvoices } from "@/modules/sales/queries/invoice-queries";
import { InvoiceListClient } from "@/modules/sales/components/invoice-list-client";
import { PageHeader } from "@/components/ui/page-header";

export default async function InvoicesPage() {
  const invoices = await getInvoices();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Facturas"
        description="Todas las facturas emitidas (POS y B2B)"
      />
      <InvoiceListClient
        invoices={invoices as Parameters<typeof InvoiceListClient>[0]["invoices"]}
      />
    </div>
  );
}
