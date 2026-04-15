"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";
import { nextFolio, DOC_TYPES } from "@/lib/folio";
import { applyInventoryExit } from "@/lib/valuation";
import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;

export interface InvoiceLineInput {
  productId: number;
  quantity: number;
  unitPrice: number;
  discount?: number;
  lotId?: number;
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

async function dispatchLines(
  tx: PrismaTx,
  params: {
    invoiceId: number;
    folio: string;
    warehouseId: number;
    lines: InvoiceLineInput[];
    userId: number | null;
  }
) {
  const lineResults: Array<{ productId: number; quantity: number; unitPrice: number; discount: number; unitCost: number; subtotal: number; lotId: number | null }> = [];

  for (const line of params.lines) {
    const product = await tx.product.findUnique({ where: { productId: line.productId } });
    if (!product) throw new Error(`Producto ${line.productId} no existe`);

    // Validar stock si no es servicio
    if (!product.isService) {
      if (!product.allowNegative) {
        const lvl = await tx.stockLevel.findUnique({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: params.warehouseId,
            },
          },
        });
        const current = lvl ? Number(lvl.currentQuantity) : 0;
        if (current < line.quantity) {
          throw new Error(
            `Stock insuficiente para ${product.name}. Disponible: ${current}, solicitado: ${line.quantity}`
          );
        }
      }

      // Valuacion: salida
      const exit = await applyInventoryExit(tx, {
        productId: line.productId,
        warehouseId: params.warehouseId,
        qty: line.quantity,
      });

      // StockMovement exit
      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          warehouseId: params.warehouseId,
          quantity: line.quantity,
          movementType: "exit",
          unitCost: exit.avgCostUsed,
          referenceDoc: params.folio,
          notes: `Venta ${params.folio}`,
          createdBy: params.userId,
        },
      });

      // StockLevel
      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: line.productId,
            warehouseId: params.warehouseId,
          },
        },
        data: {
          currentQuantity: { decrement: line.quantity },
          lastUpdated: new Date(),
        },
      });

      // LotStock si se especific\u00f3 lote
      if (line.lotId) {
        await tx.lotStock.update({
          where: { lotId_warehouseId: { lotId: line.lotId, warehouseId: params.warehouseId } },
          data: { quantity: { decrement: line.quantity } },
        });
      }

      const discount = line.discount ?? 0;
      const subtotal = line.quantity * line.unitPrice - discount;

      lineResults.push({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount,
        unitCost: exit.avgCostUsed,
        subtotal,
        lotId: line.lotId ?? null,
      });
    } else {
      // Servicio: sin stock
      const discount = line.discount ?? 0;
      const subtotal = line.quantity * line.unitPrice - discount;
      lineResults.push({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount,
        unitCost: 0,
        subtotal,
        lotId: null,
      });
    }
  }

  await tx.invoiceLine.createMany({
    data: lineResults.map((r) => ({
      invoiceId: params.invoiceId,
      ...r,
    })),
  });

  return lineResults;
}

export async function createInvoice(
  data: InvoiceInput
): Promise<ActionResult<{ invoiceId: number; folio: string }>> {
  try {
    if (!data.lines.length) return { success: false, error: "Agrega al menos una linea" };
    for (const l of data.lines) {
      if (l.quantity <= 0) return { success: false, error: "Cantidades deben ser > 0" };
      if (l.unitPrice < 0) return { success: false, error: "Precios no pueden ser negativos" };
    }

    const userId = await getCurrentUserId();

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

      const lines = await dispatchLines(tx, {
        invoiceId: invoice.invoiceId,
        folio,
        warehouseId: data.warehouseId,
        lines: data.lines,
        userId,
      });

      const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
      const total = subtotal;

      await tx.invoice.update({
        where: { invoiceId: invoice.invoiceId },
        data: { subtotal, total },
      });

      // Saldo del cliente
      await tx.customer.update({
        where: { customerId: data.customerId },
        data: { currentBalance: { increment: total } },
      });

      // Cobro inmediato si aplica (POS)
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
        await tx.invoice.update({
          where: { invoiceId: invoice.invoiceId },
          data: {
            paid: p.amount,
            status: p.amount >= total ? "paid" : "partial",
          },
        });
        await tx.customer.update({
          where: { customerId: data.customerId },
          data: { currentBalance: { decrement: p.amount } },
        });
      }

      await createAuditLog(tx, {
        action: "create",
        entityType: "Invoice",
        entityId: invoice.invoiceId,
        module: "sales",
        userId,
        newValues: { folio, customerId: data.customerId, total, channel: data.channel },
      });

      return { invoice, folio };
    });

    revalidatePath("/invoices");
    revalidatePath("/pos");
    revalidatePath("/stock");
    return { success: true, data: { invoiceId: result.invoice.invoiceId, folio: result.folio } };
  } catch (error) {
    console.error("Error creating invoice:", error);
    const msg = error instanceof Error ? error.message : "Error al crear la factura";
    return { success: false, error: msg };
  }
}

export async function registerInvoicePayment(
  invoiceId: number,
  payment: { amount: number; paymentMethod: string; paidAt: string; reference?: string }
): Promise<ActionResult<void>> {
  try {
    if (payment.amount <= 0) return { success: false, error: "El monto debe ser mayor a 0" };

    const userId = await getCurrentUserId();

    await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { invoiceId } });
      if (!invoice) throw new Error("Factura no encontrada");
      if (invoice.status === "cancelled") throw new Error("Factura cancelada");

      const alreadyPaid = Number(invoice.paid);
      const total = Number(invoice.total);
      if (alreadyPaid + payment.amount > total + 0.001) {
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
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error registering payment:", error);
    const msg = error instanceof Error ? error.message : "Error al registrar el pago";
    return { success: false, error: msg };
  }
}

export async function cancelInvoice(invoiceId: number): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { invoiceId },
        include: { lines: true },
      });
      if (!invoice) throw new Error("Factura no encontrada");
      if (invoice.status === "cancelled") throw new Error("Ya cancelada");
      if (Number(invoice.paid) > 0) {
        throw new Error("No se puede cancelar una factura con pagos registrados. Emite nota de credito.");
      }

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
      });
    });
    revalidatePath("/invoices");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error cancelling invoice:", error);
    const msg = error instanceof Error ? error.message : "Error al cancelar la factura";
    return { success: false, error: msg };
  }
}
