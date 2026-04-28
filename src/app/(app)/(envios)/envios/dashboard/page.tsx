import { EnviosDashboardClient } from "@/modules/envios/components/dashboard/envios-dashboard-client";
import { getDashboardData } from "@/modules/envios/queries/dashboard-queries";

export default async function EnviosDashboardPage() {
  const data = await getDashboardData();
  return (
    <div className="p-4 md:p-6">
      <EnviosDashboardClient data={data} />
    </div>
  );
}
