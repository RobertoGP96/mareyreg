export const dynamic = "force-dynamic";

import { RecipientListClient } from "@/modules/entregas/components/recipients/recipient-list-client";
import { listRecipients } from "@/modules/entregas/queries/recipient-queries";

export default async function DestinatariosPage() {
  const recipients = await listRecipients();
  return (
    <div className="p-4 md:p-6">
      <RecipientListClient initialRecipients={recipients} />
    </div>
  );
}
