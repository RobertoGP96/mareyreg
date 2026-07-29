export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getTripWithDetails } from "@/modules/logistics/queries/trip-queries";
import { TripDetailsClient } from "@/modules/logistics/components/trip-details-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TripDetailsPage({ params }: Props) {
  const { id } = await params;
  const tripId = parseInt(id, 10);

  if (isNaN(tripId)) notFound();

  const details = await getTripWithDetails(tripId);

  if (!details) notFound();

  return (
    <TripDetailsClient
      trip={details.trip}
      driver={details.driver}
      entity={details.entity}
      vehicles={details.vehicles}
      containers={details.containers}
    />
  );
}
