export const dynamic = "force-dynamic";

import { getPacaClients } from "@/modules/pacas/queries/paca-client-queries";
import { PacaClientListClient } from "@/modules/pacas/components/paca-client-list-client";

export default async function PacasClientesPage() {
  const clients = await getPacaClients(false);

  return (
    <div className="space-y-4">
      <PacaClientListClient
        clients={clients as Parameters<typeof PacaClientListClient>[0]["clients"]}
      />
    </div>
  );
}
