export const dynamic = "force-dynamic";

import { EnviosDashboardClient } from "@/modules/envios/components/dashboard/envios-dashboard-client";
import { getDashboardData } from "@/modules/envios/queries/dashboard-queries";

export default async function EnviosDashboardPage() {
  const data = await getDashboardData();
  return <EnviosDashboardClient data={data} />;
}
