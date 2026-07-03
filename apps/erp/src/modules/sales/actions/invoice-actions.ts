"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { nextFolio, DOC_TYPES } from "@/lib/folio";
import { dispatchLines, reverseInvoiceStock } from "@/modules/sales/lib/dispatch-lines";
import type { Prisma } from "@/generated/prisma";

const AUTH_ERROR_MESSAGE = "No autenticado";
const SESSION_ERROR_RESPONSE =
  "Tu sesión expiró o no iniciaste sesión. Vuelve a iniciar sesión e intenta de nuevo.";

// Whitelist de errores de negocio conocidos (mensajes ya en español, seguros
// de mostrar al usuario tal cual). Cualquier otro error se reemplaza por un
// mensaje generico para no filtrar detalles internos (stack, SQL, etc.).
function toUserMessage(error: unknown, genericMessage: string): string {
  if (error instanceof Error) {
    if (error.message === AUTH_ERROR_MESSAGE) return SESSION_ERROR_RESPONSE;
    if (
      error.message.startsWith("Stock insuficiente") ||
      error.message.startsWith("Stock FIFO insuficiente") ||
      error.message.startsWith("Producto ") ||
      error.message === "Factura no encontrada" ||
      error.message === "Factura cancelada" ||
      error.message === "Ya cancelada" ||
      error.message.startsWith("El monto excede el saldo pendiente") ||
      error.message.startsWith("El monto del cobro excede el total") ||
      error.message.startsWith("No se puede cancelar una factura con pagos") ||
      // Validaciones de líneas catch-weight (peso variable), en español,
      // seguras de mostrar tal cual — ver dispatch-lines.ts.
      error.message.startsWith("El producto ") ||
      error.message.startsWith("La cantidad de ") ||
      error.message.startsWith("Captura el peso real de ") ||
      error.message.endsWith("no es un producto de peso variable")
    ) {
      return error.message;
    }
  }
  return genericMessage;
}

export interface InvoiceLineInput {
  productId: number;
  presentationId?: number;
  quantity: number;
  unitPrice: number;
  discount?: number;
  lotId?: number;
  /** Peso real capturado en báscula (kg). Solo productos catch-weight. */
  actualWeightKg?: number;
}

export interface InvoiceInput {
  customerId: number;
  warehouseId: number;
  channel: "pos" | "b2b";
  issueDate: string;
  dueDate?: string;
  orderId?: number;
  sessionId?: number;
  notes?: string;
  lines: InvoiceLineInput[];
  // Si viene, registra cobro inmediato (POS)
  immediatePayment?: {
    amount: number;
    paymentMethod: string;
    reference?: string;
  };
}

export interface PriceOverride {
  productId: number;
  catalogPrice: number;
  chargedPrice: number;
}

export async function createInvoice(
  data: InvoiceInput
): Promise<ActionResult<{ invoiceId: number; folio: string }>> {
  try {
    if (!data.lines.length) return { success: false, error: "Agrega al menos una linea" };
    for (const l of data.lines) {
      if (!Number.isInteger(l.quantity) || l.quantity <= 0) {
        return { success: false, error: "Cantidades deben ser numeros enteros mayores a 0" };
      }
      if (!Number.isFinite(l.unitPrice) || l.unitPrice < 0) {
        return { success: false, error: "Precios no pueden ser negativos" };
      }
    }
    // Tolerancia minima de redondeo para comparar montos monetarios.
    const ROUNDING_TOLERANCE = 0.01;
    if (data.immediatePayment && data.immediatePayment.amount <= 0) {
      return { success: false, error: "El monto del cobro inmediato debe ser mayor a 0" };
    }

    const userId = await requireCurrentUserId();

    const result = await db.$transaction(async (tx) => {
      const folio = await nextFolio(tx, DOC_TYPES.INVOICE);

      const invoice = await tx.invoice.create({
        data: {
          folio,
          orderId: data.orderId ?? null,
          customerId: data.customerId,
          sessionId: data.sessionId ?? null,
          channel: data.channel,
          issueDate: new Date(data.issueDate),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          subtotal: 0,
          total: 0,
          status: "pending",
          notes: data.notes || null,
          createdBy: userId,
        },
      });

      const { lineResults: lines, priceOverrides } = await dispatchLines(tx, {
        invoiceId: invoice.invoiceId,
        folio,
        warehouseId: data.warehouseId,
        customerId: data.customerId,
        lines: data.lines,
        userId,
        allowManualPrice: true,
        movementNotesPrefix: "Venta",
      });

      const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
      const total = subtotal;

      // Validar el cobro inmediato contra el total ya calculado server-side
      // (no el total que hubiera enviado el cliente), con tolerancia minima
      // de redondeo, igual que registerInvoicePayment. Se valida ANTES de
      // escribir nada de pago/totales.
      if (data.immediatePayment && data.immediatePayment.amount > total + ROUNDING_TOLERANCE) {
        throw new Error(
          `El monto del cobro excede el total de la factura (${total.toFixed(2)})`
        );
      }

      // Cobro inmediato (POS) calculado en memoria antes de escribir, para
      // fusionar el update de totales + paid/status en una sola escritura.
      const paidAmount = data.immediatePayment ? data.immediatePayment.amount : 0;
      const invoiceStatus: "pending" | "partial" | "paid" =
        paidAmount <= 0 ? "pending" : paidAmount >= total ? "paid" : "partial";

      await tx.invoice.update({
        where: { invoiceId: invoice.invoiceId },
        data: { subtotal, total, paid: paidAmount, status: invoiceStatus },
      });

      // Saldo del cliente: fusiona el incremento por el total y el decremento
      // por el cobro inmediato en un solo update con el neto.
      const netBalanceChange = total - paidAmount;
      await tx.customer.update({
        where: { customerId: data.customerId },
        data: { currentBalance: { increment: netBalanceChange } },
      });

      if (data.immediatePayment) {
        const p = data.immediatePayment;
        await tx.invoicePayment.create({
          data: {
            invoiceId: invoice.invoiceId,
            amount: p.amount,
            paymentMethod: p.paymentMethod,
            paidAt: new Date(),
            reference: p.reference || null,
            createdBy: userId,
          },
        });
      }

      await createAuditLog(tx, {
        action: "create",
        entityType: "Invoice",
        entityId: invoice.invoiceId,
        module: "sales",
        userId,
        newValues: {
          folio,
          customerId: data.customerId,
          total,
          channel: data.channel,
          ...(priceOverrides.length > 0 ? { priceOverrides } : {}),
        },
      });

      return { invoice, folio };
    });

    revalidatePath("/invoices");
    revalidatePath("/pos");
    revalidatePath("/stock");
    return { success: true, data: { invoiceId: result.invoice.invoiceId, folio: result.folio } };
  } catch (error) {
    console.error("Error creating invoice:", error);
    const msg = toUserMessage(error, "Error al crear la factura");
    return { success: false, error: msg };
  }
}

export async function registerInvoicePayment(
  invoiceId: number,
  payment: { amount: number; paymentMethod: string; paidAt: string; reference?: string }
): Promise<ActionResult<void>> {
  try {
    if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
      return { success: false, error: "El monto debe ser mayor a 0" };
    }

    const userId = await requireCurrentUserId();

    await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { invoiceId } });
      if (!invoice) throw new Error("Factura no encontrada");
      if (invoice.status === "cancelled") throw new Error("Factura cancelada");

      const alreadyPaid = Number(invoice.paid);
      const total = Number(invoice.total);
      // Tolerancia minima de redondeo para comparar montos monetarios.
      if (alreadyPaid + payment.amount > total + 0.01) {
        throw new Error(`El monto excede el saldo pendiente (${(total - alreadyPaid).toFixed(2)})`);
      }

      await tx.invoicePayment.create({
        data: {
          invoiceId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          paidAt: new Date(payment.paidAt),
          reference: payment.reference || null,
          createdBy: userId,
        },
      });

      const newPaid = alreadyPaid + payment.amount;
      const newStatus: "partial" | "paid" = newPaid >= total ? "paid" : "partial";
      await tx.invoice.update({
        where: { invoiceId },
        data: { paid: newPaid, status: newStatus },
      });

      await tx.customer.update({
        where: { customerId: invoice.customerId },
        data: { currentBalance: { decrement: payment.amount } },
      });

      await createAuditLog(tx, {
        action: "payment",
        entityType: "Invoice",
        entityId: invoiceId,
        module: "sales",
        userId,
        newValues: payment,
      });
    });

    revalidatePath("/invoices");
    revalidatePath("/accounts-receivable");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error registering payment:", error);
    const msg = toUserMessage(error, "Error al registrar el pago");
    return { success: false, error: msg };
  }
}

export async function cancelInvoice(invoiceId: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { invoiceId },
        include: { lines: true, order: true },
      });
      if (!invoice) throw new Error("Factura no encontrada");
      if (invoice.status === "cancelled") throw new Error("Ya cancelada");
      if (Number(invoice.paid) > 0) {
        throw new Error("No se puede cancelar una factura con pagos registrados. Emite nota de credito.");
      }

      // Resolver el almacen de origen por producto: si la factura viene de
      // una orden (B2B/webstore), todas las lineas salieron de
      // order.warehouseId. Si es POS sin orden, se recupera del
      // StockMovement de salida original (unico por producto+folio).
      const warehouseByProductId = new Map<number, number>();
      if (invoice.order) {
        for (const line of invoice.lines) {
          warehouseByProductId.set(line.productId, invoice.order.warehouseId);
        }
      } else {
        const exitMovements = await tx.stockMovement.findMany({
          where: { referenceDoc: invoice.folio, movementType: "exit" },
          select: { productId: true, warehouseId: true },
        });
        for (const mv of exitMovements) {
          warehouseByProductId.set(mv.productId, mv.warehouseId);
        }
      }

      const reversedLines = await reverseInvoiceStock(tx, {
        folio: invoice.folio,
        warehouseByProductId,
        lines: invoice.lines.map((l) => {
          // Fallback defensivo: filas creadas antes del backfill de
          // baseQuantity (o con baseQuantity 0 por algún motivo) reconstruyen
          // el valor a partir de quantity × unitFactor.
          const bq = Number(l.baseQuantity);
          return {
            productId: l.productId,
            quantity: Number(l.quantity),
            baseQuantity: bq > 0 ? bq : Number(l.quantity) * Number(l.unitFactor),
            unitCost: Number(l.unitCost),
            lotId: l.lotId,
            pieces: l.pieces,
          };
        }),
        userId,
        movementNotesPrefix: "Cancelacion factura",
      });

      // Revertir saldo del cliente
      await tx.customer.update({
        where: { customerId: invoice.customerId },
        data: { currentBalance: { decrement: Number(invoice.total) } },
      });

      await tx.invoice.update({
        where: { invoiceId },
        data: { status: "cancelled" },
      });

      await createAuditLog(tx, {
        action: "cancel",
        entityType: "Invoice",
        entityId: invoiceId,
        module: "sales",
        userId,
        oldValues: invoice,
        newValues: { stockReversal: reversedLines },
      });
    });
    revalidatePath("/invoices");
    revalidatePath("/stock");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error cancelling invoice:", error);
    const msg = toUserMessage(error, "Error al cancelar la factura");
    return { success: false, error: msg };
  }
}
