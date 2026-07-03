"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { nextFolio, DOC_TYPES } from "@/lib/folio";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import { dispatchLines } from "@/modules/sales/lib/dispatch-lines";

const FORBIDDEN_ERROR_MESSAGE = "No tienes permisos para realizar esta acción";
const AUTH_ERROR_MESSAGE = "No autenticado";
const SESSION_ERROR_RESPONSE =
  "Tu sesión expiró o no iniciaste sesión. Vuelve a iniciar sesión e intenta de nuevo.";

export interface FulfillWebstoreOrderInput {
  orderId: number;
  weights: Array<{ orderLineId: number; actualWeightKg: number }>;
}

export interface FulfillWebstoreOrderResult {
  invoiceId: number;
  folio: string;
  total: number;
}

function toUserMessage(error: unknown, genericMessage: string): string {
  if (error instanceof Error) {
    if (error.message === AUTH_ERROR_MESSAGE) return SESSION_ERROR_RESPONSE;
    if (
      error.message === "El pedido ya fue procesado" ||
      error.message === "El pedido no está pendiente de pesaje" ||
      error.message.startsWith("Captura el peso real de") ||
      error.message.startsWith("La cantidad de") ||
      error.message.startsWith("El producto") ||
      error.message.startsWith("Stock insuficiente")
    ) {
      return error.message;
    }
  }
  return genericMessage;
}

/**
 * Pesaje y facturación de un pedido awaiting_weighing: el ERP captura el peso
 * real de cada línea catch-weight, crea la factura con dispatchLines
 * (descuenta stock, valuación y kardex por primera vez para este pedido — el
 * flujo de la tienda nunca lo hizo) y corrige SalesOrderLine/SalesOrder a los
 * montos reales. Idempotente: el claim atómico (updateMany condicionado a
 * status: "awaiting_weighing") evita doble facturación si se llama dos veces.
 */
export async function fulfillWebstoreOrder(
  input: FulfillWebstoreOrderInput
): Promise<ActionResult<FulfillWebstoreOrderResult>> {
  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");

    const result = await db.$transaction(async (tx) => {
      // Claim atómico: solo una llamada concurrente pasa de
      // "awaiting_weighing" a "received" (transitorio, mismo patrón que
      // claimOrderForProcessing en order-actions.ts). Evita doble facturación.
      const log = await tx.webstoreOrderLog.findUnique({
        where: { salesOrderId: input.orderId },
      });
      if (!log) throw new Error("Orden no encontrada");

      const claim = await tx.webstoreOrderLog.updateMany({
        where: { logId: log.logId, status: "awaiting_weighing" },
        data: { status: "received" },
      });
      if (claim.count === 0) {
        throw new Error("El pedido ya fue procesado");
      }

      const order = await tx.salesOrder.findUnique({
        where: { orderId: input.orderId },
        include: { lines: { include: { product: true } } },
      });
      if (!order) throw new Error("Orden no encontrada");

      const catchWeightLines = order.lines.filter((l) => l.pieces != null);
      const weightByLineId = new Map(
        input.weights.map((w) => [w.orderLineId, w.actualWeightKg])
      );

      for (const line of catchWeightLines) {
        const weight = weightByLineId.get(line.lineId);
        if (weight == null || !(weight > 0)) {
          throw new Error(`Captura el peso real de ${line.product.name}`);
        }
      }

      const invoiceFolio = await nextFolio(tx, DOC_TYPES.INVOICE);

      const invoice = await tx.invoice.create({
        data: {
          folio: invoiceFolio,
          orderId: order.orderId,
          customerId: order.customerId,
          channel: "online",
          issueDate: new Date(),
          subtotal: 0,
          total: 0,
          status: "pending",
        },
      });

      const { lineResults } = await dispatchLines(tx, {
        invoiceId: invoice.invoiceId,
        folio: invoiceFolio,
        warehouseId: order.warehouseId,
        customerId: order.customerId,
        lines: order.lines.map((l) => ({
          productId: l.productId,
          presentationId: l.presentationId ?? undefined,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          actualWeightKg: weightByLineId.get(l.lineId),
        })),
        userId,
        allowManualPrice: false,
        movementNotesPrefix: "Venta tienda en línea (pesaje)",
      });

      const total = lineResults.reduce((sum, l) => sum + l.subtotal, 0);

      await tx.invoice.update({
        where: { invoiceId: invoice.invoiceId },
        data: { subtotal: total, total },
      });

      // Corrige SalesOrderLine a los montos reales: dispatchLines resuelve
      // las líneas en el mismo orden que order.lines, así que el índice
      // coincide 1:1 con lineResults.
      await Promise.all(
        order.lines.map((line, idx) => {
          const r = lineResults[idx];
          return tx.salesOrderLine.update({
            where: { lineId: line.lineId },
            data: { baseQuantity: r.baseQuantity, subtotal: r.subtotal },
          });
        })
      );

      await tx.salesOrder.update({
        where: { orderId: order.orderId },
        data: { subtotal: total, total },
      });

      // Balance del cliente: processWebstoreOrder NO incrementó el saldo para
      // pedidos awaiting_weighing (no había factura); se incrementa aquí, al
      // reflejar la venta real por primera vez.
      await tx.customer.update({
        where: { customerId: order.customerId },
        data: { currentBalance: { increment: total } },
      });

      await tx.webstoreOrderLog.update({
        where: { logId: log.logId },
        data: {
          status: "processed",
          invoiceId: invoice.invoiceId,
          processedAt: new Date(),
        },
      });

      await createAuditLog(tx, {
        action: "update",
        entityType: "WebstoreOrderLog",
        entityId: log.logId,
        module: "webstore",
        userId,
        oldValues: { status: "awaiting_weighing" },
        newValues: {
          status: "processed",
          invoiceId: invoice.invoiceId,
          folio: invoiceFolio,
          total,
          weights: input.weights,
        },
      });

      return { invoiceId: invoice.invoiceId, folio: invoiceFolio, total };
    });

    revalidatePath("/webstore/ordenes");
    revalidatePath(`/webstore/ordenes/${input.orderId}`);
    revalidatePath("/invoices");
    revalidatePath("/stock");

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
    }
    if (error instanceof Error && error.message === AUTH_ERROR_MESSAGE) {
      return { success: false, error: SESSION_ERROR_RESPONSE };
    }
    console.error("Error fulfilling webstore order:", error);
    const msg = toUserMessage(error, "Error al pesar y facturar el pedido");
    return { success: false, error: msg };
  }
}
