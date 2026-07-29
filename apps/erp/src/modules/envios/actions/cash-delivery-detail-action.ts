"use server";

import type { ActionResult } from "@/types";
import { requireCurrentUserId } from "@/lib/audit";
import {
  getCashDeliveryById,
  type CashDeliveryDetail,
} from "../queries/cash-delivery-queries";

/**
 * El listado no trae el desglose por denominaciones (sería un include de tres
 * niveles sobre 200 filas). El formulario de edición lo pide al abrirse.
 */
export async function getCashDeliveryDetail(
  id: number
): Promise<ActionResult<CashDeliveryDetail>> {
  try {
    await requireCurrentUserId();
    const detail = await getCashDeliveryById(id);
    if (!detail) return { success: false, error: "Entrega no encontrada" };
    return { success: true, data: detail };
  } catch (error) {
    console.error("getCashDeliveryDetail:", error);
    return { success: false, error: "No se pudo cargar el detalle de la entrega" };
  }
}
