export const dynamic = "force-dynamic";

import { getAvailabilityByClassification } from "@/modules/pacas/queries/paca-availability-queries";
import { AvailabilityView } from "@/modules/pacas/components/availability-view";

export default async function DisponibilidadPage() {
  const data = await getAvailabilityByClassification();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Disponibilidad de Pacas</h1>
        <p className="text-muted-foreground mt-1">
          Control de inventario por clasificacion y categoria
        </p>
      </div>
      <AvailabilityView data={data} />
    </div>
  );
}
