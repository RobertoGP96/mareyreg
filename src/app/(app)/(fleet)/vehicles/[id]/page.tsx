export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getVehicleWithDetails } from "@/modules/fleet/queries/vehicle-queries";
import { VehicleDetailsClient } from "@/modules/fleet/components/vehicle-details-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VehicleDetailsPage({ params }: Props) {
  const { id } = await params;
  const vehicleId = parseInt(id, 10);

  if (isNaN(vehicleId)) {
    notFound();
  }

  const details = await getVehicleWithDetails(vehicleId);

  if (!details) {
    notFound();
  }

  return (
    <VehicleDetailsClient
      vehicle={details.vehicle}
      driver={details.driver}
      entity={details.entity}
      trips={details.trips}
    />
  );
}
