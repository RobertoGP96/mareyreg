export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getDriverWithDetails } from "@/modules/fleet/queries/driver-queries";
import { DriverDetailsClient } from "@/modules/fleet/components/driver-details-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DriverDetailsPage({ params }: Props) {
  const { id } = await params;
  const driverId = parseInt(id, 10);

  if (isNaN(driverId)) {
    notFound();
  }

  const details = await getDriverWithDetails(driverId);

  if (!details) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <DriverDetailsClient
        driver={details.driver}
        vehicles={details.vehicles}
        trips={details.trips}
      />
    </div>
  );
}
