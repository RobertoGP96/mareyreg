import { db } from "@/lib/db";
import { nextFolio, DOC_TYPES } from "@/lib/folio";
import { createAuditLog } from "@/lib/audit";
import { getEffectiveLinePrices, lineKey } from "@/modules/inventory/lib/effective-price";
import { toBaseQuantity } from "@/modules/inventory/lib/units";
import { dispatchLines } from "@/modules/sales/lib/dispatch-lines";
import { getDefaultWebstoreWarehouseId } from "./dispatch-warehouse";
import { isSkuResolved, resolveSkusBatch } from "./resolve-skus";
import type { WebstoreOrderPayload } from "./schemas";

export class NeedsReviewError extends Error {
  unresolvedSkus: string[];
  constructor(unresolvedSkus: string[]) {
    super(`SKU no disponibles para la tienda: ${unresolvedSkus.join(", ")}`);
    this.name = "NeedsReviewError";
    this.unresolvedSkus = unresolvedSkus;
  }
}

/** Tolerancia de redondeo para comparar montos monetarios (centavos). */
const PAYMENT_ROUNDING_TOLERANCE = 0.01;

export interface ProcessOrderAttribution {
  /** Usuario que originó el reproceso manual desde el panel. */
  userId?: number;
  /** API key que originó la orden vía integración externa. */
  apiKeyId?: number;
}

export async function processWebstoreOrder(
  logId: number,
  payload: WebstoreOrderPayload,
  /** Reasignación manual sku -> productId, usada al reprocesar una orden en needs_review. */
  overrides?: Record<string, number>,
  attribution?: ProcessOrderAttribution
): Promise<{ salesOrderId: number; invoiceId: number; folio: string }> {
  return db.$transaction(async (tx) => {
    const company = await tx.company.findUnique({ where: { id: 1 } });
    const expectedCurrency = company?.currency ?? "USD";
    if (payload.currency !== expectedCurrency) {
      throw new Error(
        `Moneda no soportada: se recibió ${payload.currency}, se esperaba ${expectedCurrency}`
      );
    }

    let customer = await tx.customer.findFirst({ where: { email: payload.customer.email } });
    if (!customer) {
      customer = await tx.customer.create({
        data: {
          name: payload.customer.name,
          email: payload.customer.email,
          phone: payload.customer.phone || null,
          taxId: payload.customer.taxId || null,
          address: payload.customer.address || null,
          customerType: "retail",
        },
      });
    }

    const skusNeedingLookup = payload.lines
      .filter((line) => !overrides?.[line.sku])
      .map((line) => line.sku);
    const resolvedBySku = await resolveSkusBatch(tx, skusNeedingLookup);

    const unresolvedSkus: string[] = [];
    const resolvedLines: Array<{
      productId: number;
      quantity: number;
      presentationId?: number;
    }> = [];
    for (const line of payload.lines) {
      const overrideProductId = overrides?.[line.sku];
      if (overrideProductId) {
        const overrideProduct = await tx.product.findUnique({ where: { productId: overrideProductId } });
        if (overrideProduct && overrideProduct.isActive) {
          if (!overrideProduct.webstoreEnabled) {
            // Coherente con la resolución automática: un producto oculto de
            // la tienda no debe poder despacharse vía reasignación manual.
            // Se manda a needs_review con un mensaje explícito en vez de
            // fallar toda la transacción, para que el operador pueda elegir
            // otro producto o habilitar este en el catálogo y reintentar.
            unresolvedSkus.push(`${line.sku} (producto reasignado oculto de la tienda)`);
            continue;
          }
          // La reasignación manual siempre apunta al producto base (nunca a
          // una presentación específica): factor 1, igual que antes.
          resolvedLines.push({ productId: overrideProduct.productId, quantity: line.quantity });
          continue;
        }
      }
      const product = resolvedBySku.get(line.sku);
      if (!product || !isSkuResolved(product)) {
        unresolvedSkus.push(line.sku);
        continue;
      }
      resolvedLines.push({
        productId: product.productId,
        quantity: line.quantity,
        presentationId: product.presentationId,
      });
    }
    if (unresolvedSkus.length > 0) {
      throw new NeedsReviewError(unresolvedSkus);
    }

    let warehouseId = payload.warehouseId;
    if (!warehouseId) {
      const defaultWarehouseId = await getDefaultWebstoreWarehouseId(tx);
      if (!defaultWarehouseId) throw new Error("No hay almacenes activos configurados");
      warehouseId = defaultWarehouseId;
    }

    const effectivePrices = await getEffectiveLinePrices(
      tx,
      resolvedLines.map((l) => ({
        productId: l.productId,
        presentationId: l.presentationId,
        quantity: l.quantity,
      })),
      { customerId: customer.customerId }
    );

    const priced: Array<{
      productId: number;
      presentationId?: number;
      quantity: number;
      unitPrice: number;
      unitFactor: number;
      baseQuantity: number;
    }> = [];
    for (const line of resolvedLines) {
      const key = lineKey(line.productId, line.presentationId);
      const price = effectivePrices.get(key);
      if (!price) throw new Error(`Producto ${line.productId} no encontrado`);
      priced.push({
        productId: line.productId,
        presentationId: line.presentationId,
        quantity: line.quantity,
        unitPrice: price.finalPrice,
        unitFactor: price.factor,
        baseQuantity: toBaseQuantity(line.quantity, price.factor),
      });
    }

    const subtotal = priced.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const orderFolio = await nextFolio(tx, DOC_TYPES.SALES_ORDER);
    const invoiceFolio = await nextFolio(tx, DOC_TYPES.INVOICE);

    const order = await tx.salesOrder.create({
      data: {
        folio: orderFolio,
        customerId: customer.customerId,
        warehouseId,
        channel: "online",
        status: "confirmed",
        orderDate: new Date(),
        subtotal,
        total: subtotal,
        notes: payload.notes || null,
      },
    });

    await tx.salesOrderLine.createMany({
      data: priced.map((l) => ({
        orderId: order.orderId,
        productId: l.productId,
        presentationId: l.presentationId ?? null,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: 0,
        fulfilledQty: l.quantity,
        subtotal: l.quantity * l.unitPrice,
        // factor/baseQuantity resueltos server-side (ver getEffectiveLinePrices
        // arriba): 1 y quantity respectivamente cuando la línea no trae
        // presentación, igual que el comportamiento anterior.
        unitFactor: l.unitFactor,
        baseQuantity: l.baseQuantity,
      })),
    });

    const invoice = await tx.invoice.create({
      data: {
        folio: invoiceFolio,
        orderId: order.orderId,
        customerId: customer.customerId,
        channel: "online",
        issueDate: new Date(),
        subtotal,
        total: subtotal,
        status: "pending",
        notes: payload.notes || null,
      },
    });

    await dispatchLines(tx, {
      invoiceId: invoice.invoiceId,
      folio: invoiceFolio,
      warehouseId,
      customerId: customer.customerId,
      lines: priced.map((l) => ({
        productId: l.productId,
        presentationId: l.presentationId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      allowManualPrice: false,
      movementNotesPrefix: "Venta tienda en línea",
    });

    await tx.customer.update({
      where: { customerId: customer.customerId },
      data: { currentBalance: { increment: subtotal } },
    });

    if (payload.payment) {
      if (payload.payment.amount > subtotal + PAYMENT_ROUNDING_TOLERANCE) {
        throw new Error(
          `El pago (${payload.payment.amount}) excede el total de la orden (${subtotal})`
        );
      }

      await tx.invoicePayment.create({
        data: {
          invoiceId: invoice.invoiceId,
          amount: payload.payment.amount,
          paymentMethod: payload.payment.method,
          paidAt: new Date(),
          reference: payload.payment.reference || null,
        },
      });
      const newStatus = payload.payment.amount >= subtotal ? "paid" : "partial";
      await tx.invoice.update({
        where: { invoiceId: invoice.invoiceId },
        data: { paid: payload.payment.amount, status: newStatus },
      });
      await tx.customer.update({
        where: { customerId: customer.customerId },
        data: { currentBalance: { decrement: payload.payment.amount } },
      });
    }

    await tx.webstoreOrderLog.update({
      where: { logId },
      data: {
        status: "processed",
        salesOrderId: order.orderId,
        invoiceId: invoice.invoiceId,
        processedAt: new Date(),
      },
    });

    await createAuditLog(tx, {
      action: "create",
      entityType: "WebstoreOrderLog",
      entityId: logId,
      module: "webstore",
      userId: attribution?.userId ?? null,
      newValues: {
        externalOrderId: payload.externalOrderId,
        salesOrderId: order.orderId,
        invoiceId: invoice.invoiceId,
        folio: orderFolio,
        apiKeyId: attribution?.apiKeyId,
      },
    });

    return { salesOrderId: order.orderId, invoiceId: invoice.invoiceId, folio: orderFolio };
  });
}
