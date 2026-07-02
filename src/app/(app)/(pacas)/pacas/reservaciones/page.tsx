export const dynamic = "force-dynamic";

import { getReservations } from "@/modules/pacas/queries/paca-reservation-queries";
import { ReservationListClient } from "@/modules/pacas/components/reservation-list-client";
import { getActivePacaClientsForPicker } from "@/modules/pacas/queries/paca-client-queries";
import { db } from "@/lib/db";

export default async function ReservacionesPage() {
  const [reservations, categoriesWithInventory, pacaClients] = await Promise.all([
    getReservations(),
    db.pacaCategory.findMany({
      include: { inventory: true, classification: true },
      orderBy: { name: "asc" },
    }),
    getActivePacaClientsForPicker(),
  ]);

  const availableCategories = categoriesWithInventory
    .filter((c) => (c.inventory?.available ?? 0) > 0)
    .map((c) => ({
      categoryId: c.categoryId,
      name: c.name,
      available: c.inventory!.available,
    }));

  return (
    <div className="space-y-4">
      <ReservationListClient
        reservations={reservations as Parameters<typeof ReservationListClient>[0]["reservations"]}
        availableCategories={availableCategories}
        pacaClients={pacaClients}
      />
    </div>
  );
}
