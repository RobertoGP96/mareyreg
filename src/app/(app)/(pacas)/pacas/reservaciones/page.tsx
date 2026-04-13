export const dynamic = "force-dynamic";

import { getReservations } from "@/modules/pacas/queries/paca-reservation-queries";
import { ReservationListClient } from "@/modules/pacas/components/reservation-list-client";
import { db } from "@/lib/db";

export default async function ReservacionesPage() {
  const [reservations, availablePacas] = await Promise.all([
    getReservations(),
    db.paca.findMany({
      where: { status: "available" },
      select: { pacaId: true, code: true, status: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reservaciones</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona las reservaciones de pacas
        </p>
      </div>
      <ReservationListClient
        reservations={reservations as Parameters<typeof ReservationListClient>[0]["reservations"]}
        availablePacas={availablePacas}
      />
    </div>
  );
}
