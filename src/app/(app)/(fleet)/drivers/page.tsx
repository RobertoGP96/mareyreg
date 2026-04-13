export const dynamic = "force-dynamic";

import { getDrivers } from "@/modules/fleet/queries/driver-queries";
import { getVehicles } from "@/modules/fleet/queries/vehicle-queries";
import { DriverListClient } from "@/modules/fleet/components/driver-list-client";

export default async function DriversPage() {
  const [drivers, vehicles] = await Promise.all([
    getDrivers(),
    getVehicles(),
  ]);

  return (
    <div className="space-y-6">
      <DriverListClient initialDrivers={drivers} vehicles={vehicles} />
    </div>
  );
}
