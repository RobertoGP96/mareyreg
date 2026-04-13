export const dynamic = "force-dynamic";

import { getVehicles } from "@/modules/fleet/queries/vehicle-queries";
import { getDrivers } from "@/modules/fleet/queries/driver-queries";
import { VehicleListClient } from "@/modules/fleet/components/vehicle-list-client";

export default async function VehiclesPage() {
  const [vehicles, drivers] = await Promise.all([
    getVehicles(),
    getDrivers(),
  ]);

  return (
    <div className="space-y-6">
      <VehicleListClient initialVehicles={vehicles} drivers={drivers} />
    </div>
  );
}
