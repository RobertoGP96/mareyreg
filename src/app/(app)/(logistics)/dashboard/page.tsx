export const dynamic = "force-dynamic";

import { getLogisticsDashboard } from "@/modules/logistics/queries/dashboard-queries";
import { LogisticsDashboardClient } from "@/modules/logistics/components/logistics-dashboard-client";

export default async function LogisticsDashboardPage() {
  const data = await getLogisticsDashboard();
  return (
    <div className="space-y-4">
      <LogisticsDashboardClient data={data} />
    </div>
  );
}
