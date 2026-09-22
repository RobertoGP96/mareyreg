export const dynamic = "force-dynamic";

import { ProviderListClient } from "@/modules/entregas/components/providers/provider-list-client";
import { listProviders } from "@/modules/entregas/queries/provider-queries";

export default async function ProveedoresPage() {
  const providers = await listProviders();
  return (
    <div className="p-4 md:p-6">
      <ProviderListClient initialProviders={providers} />
    </div>
  );
}
