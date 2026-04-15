export const dynamic = "force-dynamic";

import { getInvoices } from "@/modules/sales/queries/invoice-queries";
import { InvoiceListClient } from "@/modules/sales/components/invoice-list-client";

export default async function InvoicesPage() {
  const invoices = await getInvoices();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
        <p className="text-muted-foreground mt-1">Todas las facturas emitidas (POS y B2B)</p>
      </div>
      <InvoiceListClient
        invoices={invoices as Parameters<typeof InvoiceListClient>[0]["invoices"]}
      />
    </div>
  );
}
