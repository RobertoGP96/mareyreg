export const dynamic = "force-dynamic";

import { getPacaDashboard } from "@/modules/pacas/queries/paca-dashboard-queries";
import { PacaDashboardClient } from "@/modules/pacas/components/paca-dashboard-client";

export default async function PacasDashboardPage() {
  const data = await getPacaDashboard();
  return (
    <div className="space-y-4">
      <PacaDashboardClient data={data} />
    </div>
  );
}
