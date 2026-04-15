export const dynamic = "force-dynamic";

import { getPacaClients } from "@/modules/pacas/queries/paca-client-queries";
import { PacaClientListClient } from "@/modules/pacas/components/paca-client-list-client";

export default async function PacasClientesPage() {
  const clients = await getPacaClients(false);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold font-headline tracking-tight text-foreground">
          Clientes Pacas
        </h1>
        <p className="text-muted-foreground mt-1">
          Directorio de contactos usado en reservaciones y ventas de pacas
        </p>
      </div>
      <PacaClientListClient
        clients={clients as Parameters<typeof PacaClientListClient>[0]["clients"]}
      />
    </div>
  );
}
