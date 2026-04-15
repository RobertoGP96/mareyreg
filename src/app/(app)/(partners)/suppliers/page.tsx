export const dynamic = "force-dynamic";

import { getSuppliers } from "@/modules/suppliers/queries/supplier-queries";
import { SupplierListClient } from "@/modules/suppliers/components/supplier-list-client";

export default async function SuppliersPage() {
  const suppliers = await getSuppliers(true);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold font-headline tracking-tight text-foreground">
          Proveedores
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tus proveedores para compras y seguimiento de costos
        </p>
      </div>
      <SupplierListClient
        suppliers={suppliers as Parameters<typeof SupplierListClient>[0]["suppliers"]}
      />
    </div>
  );
}
