export const dynamic = "force-dynamic";

import { getTrips } from "@/modules/logistics/queries/trip-queries";
import { getDrivers } from "@/modules/fleet/queries/driver-queries";
import { TripListClient } from "@/modules/logistics/components/trip-list-client";

export default async function TripsPage() {
  const [trips, drivers] = await Promise.all([getTrips(), getDrivers()]);

  return (
    <div className="space-y-6">
      <TripListClient initialTrips={trips} drivers={drivers} />
    </div>
  );
}
