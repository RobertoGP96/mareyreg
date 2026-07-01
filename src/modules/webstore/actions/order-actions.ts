"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import { webstoreOrderPayloadSchema } from "../lib/schemas";
import { processWebstoreOrder, NeedsReviewError } from "../lib/process-order";

const FORBIDDEN_ERROR_MESSAGE = "No tienes permisos para realizar esta acción";

/**
 * Claim atómico previo al procesamiento: el enum WebstoreOrderStatus no tiene
 * un valor "processing" (no se modifica schema.prisma en este cambio), así que
 * reutilizamos "received" como estado transitorio de "en proceso". Es seguro
 * porque "received" ya significa "en la cola, sin resolver" en la UI (badge
 * "Recibida"/pending) y no aparece en los contadores de needs_review/error/
 * processed del dashboard. El updateMany condicionado por status actúa como
 * compare-and-swap: sólo una llamada concurrente gana el claim.
 */
async function claimOrderForProcessing(logId: number): Promise<boolean> {
  const claim = await db.webstoreOrderLog.updateMany({
    where: { logId, status: { in: ["needs_review", "error"] } },
    data: { status: "received" },
  });
  return claim.count === 1;
}

async function restoreOrderStatus(logId: number, status: "needs_review" | "error", message: string) {
  await db.webstoreOrderLog.update({
    where: { logId },
    data: { status, errorMessage: message },
  });
}

export async function reprocessOrder(
  logId: number,
  overrides?: Record<string, number>
): Promise<ActionResult<{ salesOrderId: number; invoiceId: number; folio: string }>> {
  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");

    const log = await db.webstoreOrderLog.findUnique({ where: { logId } });
    if (!log) return { success: false, error: "Orden no encontrada" };
    if (log.status === "processed") {
      return { success: false, error: "Esta orden ya fue procesada" };
    }

    const parsed = webstoreOrderPayloadSchema.safeParse(log.rawPayload);
    if (!parsed.success) {
      return { success: false, error: "El payload guardado no es válido" };
    }

    const claimed = await claimOrderForProcessing(logId);
    if (!claimed) {
      return { success: false, error: "La orden ya fue procesada o está en proceso" };
    }

    try {
      const result = await processWebstoreOrder(logId, parsed.data, overrides, { userId });
      revalidatePath("/webstore/ordenes");
      revalidatePath(`/webstore/ordenes/${logId}`);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof NeedsReviewError) {
        await restoreOrderStatus(logId, "needs_review", error.message);
        revalidatePath(`/webstore/ordenes/${logId}`);
        return { success: false, error: error.message };
      }
      console.error("Error reprocessing webstore order:", error);
      await restoreOrderStatus(logId, "error", "Error al reprocesar la orden");
      revalidatePath(`/webstore/ordenes/${logId}`);
      return { success: false, error: "Error al reprocesar la orden" };
    }
  } catch (error) {
    if (error instanceof Error && error.message === "No autenticado") {
      return { success: false, error: "Debes iniciar sesión para realizar esta acción" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    console.error("Error reprocessing webstore order:", error);
    return { success: false, error: "Error al reprocesar la orden" };
  }
}
