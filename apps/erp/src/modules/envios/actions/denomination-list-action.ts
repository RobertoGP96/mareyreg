"use server";

import type { ActionResult } from "@/types";
import { requireCurrentUserId } from "@/lib/audit";
import {
  listDenominationsByCurrency,
  type DenominationRow,
} from "../queries/currency-denomination-queries";

/** El panel de denominaciones carga bajo demanda al abrirse desde Monedas. */
export async function getDenominationsForCurrency(
  currencyId: number
): Promise<ActionResult<DenominationRow[]>> {
  try {
    await requireCurrentUserId();
    return { success: true, data: await listDenominationsByCurrency(currencyId) };
  } catch (error) {
    console.error("getDenominationsForCurrency:", error);
    return { success: false, error: "No se pudieron cargar las denominaciones" };
  }
}
