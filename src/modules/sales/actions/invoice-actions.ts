"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { nextFolio, DOC_TYPES } from "@/lib/folio";
import { applyInventoryExit } from "@/lib/valuation";
import { getEffectivePrice } from "@/modules/inventory/lib/effective-price";
import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;

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
      error.message.startsWith("No se puede cancelar una factura con pagos")
    ) {
      return error.message;
    }
  }
  return genericMessage;
}

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

export interface PriceOverride {
  productId: number;
  catalogPrice: number;
  chargedPrice: number;
}

async function dispatchLines(
  tx: PrismaTx,
  params: {
    invoiceId: number;
    folio: string;
    warehouseId: number;
    customerId: number;
    lines: InvoiceLineInput[];
    userId: number;
  }
) {
  const lineResults: Array<{ productId: number; quantity: number; unitPrice: number; discount: number; unitCost: number; subtotal: number; lotId: number | null }> = [];
  const priceOverrides: PriceOverride[] = [];

  for (const line of params.lines) {
    const product = await tx.product.findUnique({ where: { productId: line.productId } });
    if (!product) throw new Error(`Producto ${line.productId} no existe`);

    // Precio de catalogo server-side (fuente de verdad). El POS permite
    // edicion manual legitima del precio, asi que se acepta el precio que
    // envia el cliente, pero se registra en el audit log cuando difiere del
    // precio de catalogo, para trazabilidad.
    const effective = await getEffectivePrice(tx, {
      productId: line.productId,
      quantity: line.quantity,
      customerId: params.customerId,
    });
    if (Math.abs(line.unitPrice - effective.finalPrice) > 0.0001) {
      priceOverrides.push({
        productId: line.productId,
        catalogPrice: effective.finalPrice,
        chargedPrice: line.unitPrice,
      });
    }

    // Validar stock si no es servicio
    if (!product.isService) {
      // Descontar StockLevel de forma atomica: si el producto no permite
      // stock negativo, updateMany solo aplica si currentQuantity >= qty;
      // si count === 0, no habia stock suficiente. Si allowNegative es
      // true, se descuenta sin condicion (puede quedar en negativo).
      if (!product.allowNegative) {
        const updated = await tx.stockLevel.updateMany({
          where: {
            productId: line.productId,
            warehouseId: params.warehouseId,
            currentQuantity: { gte: line.quantity },
          },
          data: {
            currentQuantity: { decrement: line.quantity },
            lastUpdated: new Date(),
          },
        });
        if (updated.count === 0) {
          const lvl = await tx.stockLevel.findUnique({
            where: {
              productId_warehouseId: {
                productId: line.productId,
                warehouseId: params.warehouseId,
              },
            },
          });
          const current = lvl ? Number(lvl.currentQuantity) : 0;
          throw new Error(
            `Stock insuficiente para ${product.name}. Disponible: ${current}, solicitado: ${line.quantity}`
          );
        }
      } else {
        await tx.stockLevel.upsert({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: params.warehouseId,
            },
          },
          create: {
            productId: line.productId,
            warehouseId: params.warehouseId,
            currentQuantity: -line.quantity,
          },
          update: {
            currentQuantity: { decrement: line.quantity },
            lastUpdated: new Date(),
          },
        });
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

  return { lineResults, priceOverrides };
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
      });

      const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
      const total = subtotal;

      // Validar el cobro inmediato contra el total ya calculado server-side
      // (no el total que hubiera enviado el cliente), con tolerancia minima
      // de redondeo, igual que registerInvoicePayment.
      if (data.immediatePayment && data.immediatePayment.amount > total + ROUNDING_TOLERANCE) {
        throw new Error(
          `El monto del cobro excede el total de la factura (${total.toFixed(2)})`
        );
      }

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
    const msg = toUserMessage(error, "Error al cancelar la factura");
    return { success: false, error: msg };
  }
}
