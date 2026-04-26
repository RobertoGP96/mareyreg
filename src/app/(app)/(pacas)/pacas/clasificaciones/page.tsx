export const dynamic = "force-dynamic";

import { getPacaClassifications } from "@/modules/pacas/queries/paca-classification-queries";
import { PacaClassificationListClient } from "@/modules/pacas/components/paca-classification-list-client";

export default async function PacaClassificationsPage() {
  const items = await getPacaClassifications();
  return (
    <div className="space-y-4">
      <PacaClassificationListClient initialClassifications={items} />
    </div>
  );
}
