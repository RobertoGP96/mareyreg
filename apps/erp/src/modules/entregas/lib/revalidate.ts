import { revalidatePath } from "next/cache";

// Una entrega afecta su listado, su página de detalle y el reporte de
// comisiones por mensajero.
export function revalidateDeliveries(deliveryId?: number) {
  revalidatePath("/entregas");
  revalidatePath("/entregas/mensajeros");
  if (deliveryId != null) revalidatePath(`/entregas/${deliveryId}`);
}
