"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { nextFolio, DOC_TYPES } from "@/lib/folio";
import { dispatchLines, reverseInvoiceStock } from "@/modules/sales/lib/dispatch-lines";
import { getBaseCurrency, getRateToBase, roundToCurrency, GlobalRateNotConfiguredError, type DbOrTx } from "@/lib/currency";
import type { Prisma } from "@/generated/prisma";

// Tolerancia de redondeo para comparar montos monetarios contra el total,
// expresada en la unidad más pequeña representable de la moneda base (ej.
// 1 CUP si decimalPlaces=0, 0.01 si decimalPlaces=2). Cubre artefactos de
// redondeo entre pagos multi-moneda, NO pagos parciales legítimos.
function paymentTolerance(baseDecimalPlaces: number): number {
  return 1 / 10 ** baseDecimalPlaces;
}

interface ResolvedPayment {
  amount: number; // Equivalente en moneda base (CUP), recortado al saldo si excede.
  currencyId: number | null;
  amountTendered: number | null;
  exchangeRate: number | null;
  paymentMethod: string;
  reference: string | null;
  /** Vuelto en CUP, si este pago (normalmente en efectivo) excedió el saldo restante. */
  changeBase: number;
}

/**
 * Resuelve una lista de pagos (posiblemente en distintas monedas) a sus
 * equivalentes en moneda base, cacheando la tasa por moneda (una sola
 * consulta por currencyId aunque se repita en varias líneas). Recorta el
 * ÚLTIMO pago que exceda el saldo restante (comportamiento de "vuelto" del
 * POS: el pago en efectivo se aplica neto, el excedente no se persiste).
 */
async function resolvePayments(
  tx: DbOrTx,
  payments: PaymentInput[],
  remainingBalance: number
): Promise<ResolvedPayment[]> {
  const rateCache = new Map<number, { rate: number }>();
  const base = await getBaseCurrency(tx);

  const resolved: ResolvedPayment[] = [];
  let remaining = remainingBalance;

  for (const p of payments) {
    const isBaseCurrency = p.currencyId == null || p.currencyId === base.currencyId;
    let rate = 1;
    let exchangeRate: number | null = null;
    let currencyId: number | null = null;

    if (!isBaseCurrency) {
      const key = p.currencyId!;
      let cached = rateCache.get(key);
      if (!cached) {
        const snapshot = await getRateToBase(tx, key);
        cached = { rate: snapshot.rate };
        rateCache.set(key, cached);
      }
      rate = cached.rate;
      exchangeRate = cached.rate;
      currencyId = key;
    }

    const amountBaseFull = roundToCurrency(p.amountTendered * rate, base.decimalPlaces);
    // `amountTendered` conserva SIEMPRE lo físicamente entregado por el
    // cliente; `amount` (amountBaseApplied) es lo aplicado al saldo en CUP.
    // La diferencia es el vuelto entregado en efectivo y no se persiste
    // (igual que en una caja física) — por eso amountTendered × exchangeRate
    // puede exceder `amount` legítimamente.
    const change = Math.max(0, amountBaseFull - remaining);
    const amountBaseApplied = Math.min(amountBaseFull, Math.max(remaining, 0));
    remaining -= amountBaseApplied;

    resolved.push({
      amount: amountBaseApplied,
      currencyId,
      amountTendered: isBaseCurrency ? null : p.amountTendered,
      exchangeRate,
      paymentMethod: p.paymentMethod,
      reference: p.reference || null,
      changeBase: change,
    });
  }

  return resolved;
}

const AUTH_ERROR_MESSAGE = "No autenticado";
const SESSION_ERROR_RESPONSE =
  "Tu sesión expiró o no iniciaste sesión. Vuelve a iniciar sesión e intenta de nuevo.";

// Whitelist de errores de negocio conocidos (mensajes ya en español, seguros
// de mostrar al usuario tal cual). Cualquier otro error se reemplaza por un
// mensaje generico para no filtrar detalles internos (stack, SQL, etc.).
function toUserMessage(error: unknown, genericMessage: string): string {
  // Precio en moneda sin tasa configurada (multi-moneda): mensaje accionable.
  if (error instanceof GlobalRateNotConfiguredError) return error.message;
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
      error.message.endsWith("no es un producto de peso variable") ||
      // Validaciones de venta por piezas registradas (ProductPiece).
      error.message.startsWith("La pieza ") ||
      error.message.startsWith("El peso capturado de ") ||
      error.message === "Hay piezas repetidas en la venta"
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
  /**
   * Piezas registradas seleccionadas (catch-weight). quantity debe ser
   * pieceIds.length; el peso real se deriva server-side de los pesos
   * registrados — ver dispatch-lines.ts.
   */
  pieceIds?: number[];
}

/** Un pago dentro de un cobro (posiblemente multi-moneda, ej. POS). */
export interface PaymentInput {
  /** Moneda ENTREGADA por el cliente. Omitida o = moneda base -> sin conversión. */
  currencyId?: number | null;
  /** Monto en `currencyId` (o en la moneda base si se omite currencyId). */
  amountTendered: number;
  paymentMethod: string;
  reference?: string;
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
  /** Cobro inmediato multi-moneda (POS). Preferido sobre `immediatePayment`. */
  immediatePayments?: PaymentInput[];
  /** @deprecated Compat: shape anterior, un solo pago en moneda base. Usa `immediatePayments`. */
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
): Promise<ActionResult<{ invoiceId: number; folio: string; changeBase: number }>> {
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

    // Compat: shape anterior (`immediatePayment`) se trata como un pago único
    // en moneda base. `immediatePayments` (nuevo, multi-moneda) tiene prioridad
    // si ambos vinieran presentes.
    const paymentInputs: PaymentInput[] =
      data.immediatePayments ??
      (data.immediatePayment
        ? [
            {
              currencyId: null,
              amountTendered: data.immediatePayment.amount,
              paymentMethod: data.immediatePayment.paymentMethod,
              reference: data.immediatePayment.reference,
            },
          ]
        : []);

    for (const p of paymentInputs) {
      if (!Number.isFinite(p.amountTendered) || p.amountTendered <= 0) {
        return { success: false, error: "El monto del cobro inmediato debe ser mayor a 0" };
      }
      if (!p.paymentMethod?.trim()) {
        return { success: false, error: "El metodo de pago es requerido" };
      }
      if (p.currencyId != null && !(Number.isInteger(p.currencyId) && p.currencyId > 0)) {
        return { success: false, error: "Moneda inválida en el pago." };
      }
    }

    const userId = await requireCurrentUserId();

    const result = await db.$transaction(async (tx) => {
      const base = await getBaseCurrency(tx);
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
          currencyId: null, // factura siempre en moneda base
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

      // Resuelve cada pago a su equivalente en CUP (tasa cacheada por moneda),
      // recortando el excedente de cualquier pago que exceda el saldo restante
      // (vuelto — no se persiste, solo se usa para mostrarlo en la UI).
      const resolvedPayments = await resolvePayments(tx, paymentInputs, total);
      const paidAmount = resolvedPayments.reduce((s, p) => s + p.amount, 0);
      const tolerance = paymentTolerance(base.decimalPlaces);
      if (paidAmount > total + tolerance) {
        throw new Error(
          `El monto del cobro excede el total de la factura (${total.toFixed(2)})`
        );
      }

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

      if (resolvedPayments.length > 0) {
        await tx.invoicePayment.createMany({
          data: resolvedPayments.map((p) => ({
            invoiceId: invoice.invoiceId,
            amount: p.amount,
            paymentMethod: p.paymentMethod,
            paidAt: new Date(),
            reference: p.reference,
            createdBy: userId,
            currencyId: p.currencyId,
            amountTendered: p.amountTendered,
            exchangeRate: p.exchangeRate,
          })),
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

      const changeBase = roundToCurrency(
        resolvedPayments.reduce((s, p) => s + p.changeBase, 0),
        base.decimalPlaces
      );

      return { invoice, folio, changeBase };
    });

    revalidatePath("/invoices");
    revalidatePath("/pos");
    revalidatePath("/stock");
    return {
      success: true,
      data: { invoiceId: result.invoice.invoiceId, folio: result.folio, changeBase: result.changeBase },
    };
  } catch (error) {
    console.error("Error creating invoice:", error);
    const msg = toUserMessage(error, "Error al crear la factura");
    return { success: false, error: msg };
  }
}

export interface RegisterInvoicePaymentInput {
  /** Moneda ENTREGADA por el cliente. Omitida o = moneda base -> sin conversión. */
  currencyId?: number | null;
  /** Monto en `currencyId` (o en la moneda base si se omite currencyId). */
  amountTendered: number;
  paymentMethod: string;
  paidAt: string;
  reference?: string;
}

export async function registerInvoicePayment(
  invoiceId: number,
  payment: RegisterInvoicePaymentInput | { amount: number; paymentMethod: string; paidAt: string; reference?: string }
): Promise<ActionResult<{ changeBase: number }>> {
  try {
    // Compat: shape anterior usaba `amount` (siempre moneda base).
    const normalized: RegisterInvoicePaymentInput =
      "amountTendered" in payment
        ? payment
        : { amountTendered: payment.amount, paymentMethod: payment.paymentMethod, paidAt: payment.paidAt, reference: payment.reference };

    if (!Number.isFinite(normalized.amountTendered) || normalized.amountTendered <= 0) {
      return { success: false, error: "El monto debe ser mayor a 0" };
    }
    if (!normalized.paymentMethod?.trim()) {
      return { success: false, error: "El metodo de pago es requerido" };
    }
    if (
      normalized.currencyId != null &&
      !(Number.isInteger(normalized.currencyId) && normalized.currencyId > 0)
    ) {
      return { success: false, error: "Moneda inválida en el pago." };
    }

    const userId = await requireCurrentUserId();

    const changeBase = await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { invoiceId } });
      if (!invoice) throw new Error("Factura no encontrada");
      if (invoice.status === "cancelled") throw new Error("Factura cancelada");

      const base = await getBaseCurrency(tx);
      const alreadyPaid = Number(invoice.paid);
      const total = Number(invoice.total);
      const remaining = Math.max(total - alreadyPaid, 0);

      const [resolved] = await resolvePayments(
        tx,
        [
          {
            currencyId: normalized.currencyId,
            amountTendered: normalized.amountTendered,
            paymentMethod: normalized.paymentMethod,
            reference: normalized.reference,
          },
        ],
        remaining
      );

      const tolerance = paymentTolerance(base.decimalPlaces);
      // resolvePayments ya recorta el pago al saldo restante (vuelto), pero si
      // el monto entregado no alcanza a cubrir nada (remaining ya era 0) o el
      // resultado excede el saldo por artefactos de redondeo, se rechaza.
      if (resolved.amount <= 0) {
        throw new Error(`El monto excede el saldo pendiente (${remaining.toFixed(2)})`);
      }
      if (resolved.amount > remaining + tolerance) {
        throw new Error(`El monto excede el saldo pendiente (${remaining.toFixed(2)})`);
      }

      await tx.invoicePayment.create({
        data: {
          invoiceId,
          amount: resolved.amount,
          paymentMethod: resolved.paymentMethod,
          paidAt: new Date(normalized.paidAt),
          reference: resolved.reference,
          createdBy: userId,
          currencyId: resolved.currencyId,
          amountTendered: resolved.amountTendered,
          exchangeRate: resolved.exchangeRate,
        },
      });

      const newPaid = alreadyPaid + resolved.amount;
      const newStatus: "partial" | "paid" = newPaid >= total ? "paid" : "partial";
      await tx.invoice.update({
        where: { invoiceId },
        data: { paid: newPaid, status: newStatus },
      });

      await tx.customer.update({
        where: { customerId: invoice.customerId },
        data: { currentBalance: { decrement: resolved.amount } },
      });

      await createAuditLog(tx, {
        action: "payment",
        entityType: "Invoice",
        entityId: invoiceId,
        module: "sales",
        userId,
        newValues: {
          amount: resolved.amount,
          currencyId: resolved.currencyId,
          amountTendered: resolved.amountTendered,
          paymentMethod: resolved.paymentMethod,
          paidAt: normalized.paidAt,
        },
      });

      return roundToCurrency(resolved.changeBase, base.decimalPlaces);
    });

    revalidatePath("/invoices");
    revalidatePath("/accounts-receivable");
    return { success: true, data: { changeBase } };
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

      // Liberar las piezas registradas consumidas por esta factura: vuelven a
      // estar disponibles en su almacén (reverseInvoiceStock ya reingresó los
      // kg y piezas agregados en la misma tx).
      await tx.productPiece.updateMany({
        where: {
          invoiceLineId: { in: invoice.lines.map((l) => l.lineId) },
          status: "sold",
        },
        data: {
          status: "available",
          invoiceLineId: null,
          salesOrderLineId: null,
          soldAt: null,
          reservedAt: null,
        },
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
