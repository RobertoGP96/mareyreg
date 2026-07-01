"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { webstoreOrderPayloadSchema } from "../lib/schemas";
import { processWebstoreOrder, NeedsReviewError } from "../lib/process-order";

export async function reprocessOrder(
  logId: number,
  overrides?: Record<string, number>
): Promise<ActionResult<{ salesOrderId: number; invoiceId: number; folio: string }>> {
  try {
    const log = await db.webstoreOrderLog.findUnique({ where: { logId } });
    if (!log) return { success: false, error: "Orden no encontrada" };
    if (log.status === "processed") {
      return { success: false, error: "Esta orden ya fue procesada" };
    }

    const parsed = webstoreOrderPayloadSchema.safeParse(log.rawPayload);
    if (!parsed.success) {
      return { success: false, error: "El payload guardado no es válido" };
    }

    const result = await processWebstoreOrder(logId, parsed.data, overrides);
    revalidatePath("/webstore/ordenes");
    revalidatePath(`/webstore/ordenes/${logId}`);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof NeedsReviewError) {
      await db.webstoreOrderLog.update({
        where: { logId },
        data: { status: "needs_review", errorMessage: error.message },
      });
      revalidatePath(`/webstore/ordenes/${logId}`);
      return { success: false, error: error.message };
    }
    console.error("Error reprocessing webstore order:", error);
    const message = error instanceof Error ? error.message : "Error al reprocesar la orden";
    await db.webstoreOrderLog.update({
      where: { logId },
      data: { status: "error", errorMessage: message },
    });
    revalidatePath(`/webstore/ordenes/${logId}`);
    return { success: false, error: message };
  }
}
