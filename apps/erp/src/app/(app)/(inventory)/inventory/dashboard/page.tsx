export const dynamic = "force-dynamic";

import { getInventoryDashboard } from "@/modules/inventory/queries/inventory-dashboard-queries";
import { InventoryDashboardClient } from "@/modules/inventory/components/inventory-dashboard-client";

export default async function InventoryDashboardPage() {
  const data = await getInventoryDashboard();
  return (
    <div className="space-y-4">
      <InventoryDashboardClient data={data} />
    </div>
  );
}
