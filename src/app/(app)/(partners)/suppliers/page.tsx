export const dynamic = "force-dynamic";

import { getSuppliers } from "@/modules/suppliers/queries/supplier-queries";
import { SupplierListClient } from "@/modules/suppliers/components/supplier-list-client";
import { PageHeader } from "@/components/ui/page-header";

export default async function SuppliersPage() {
  const suppliers = await getSuppliers(true);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Proveedores"
        description="Gestiona tus proveedores para compras y seguimiento de costos"
      />
      <SupplierListClient
        suppliers={suppliers as Parameters<typeof SupplierListClient>[0]["suppliers"]}
      />
    </div>
  );
}
