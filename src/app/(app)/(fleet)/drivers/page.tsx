export const dynamic = "force-dynamic";

import { getDrivers } from "@/modules/fleet/queries/driver-queries";
import { getVehicles } from "@/modules/fleet/queries/vehicle-queries";
import { getEntities } from "@/modules/fleet/queries/entity-queries";
import { DriverListClient } from "@/modules/fleet/components/driver-list-client";

export default async function DriversPage() {
  const [drivers, vehicles, entities] = await Promise.all([
    getDrivers(),
    getVehicles(),
    getEntities(),
  ]);

  return (
    <div className="space-y-6">
      <DriverListClient
        initialDrivers={drivers}
        vehicles={vehicles}
        entities={entities}
      />
    </div>
  );
}
