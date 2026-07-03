import { db } from "@/lib/db";
import { nextFolio, DOC_TYPES } from "@/lib/folio";
import { createAuditLog } from "@/lib/audit";
import { getBaseCurrency } from "@/lib/currency";
import { getEffectiveLinePrices, lineKey } from "@/modules/inventory/lib/effective-price";
import { toBaseQuantity, piecesFor } from "@/modules/inventory/lib/units";
import { dispatchLines } from "@/modules/sales/lib/dispatch-lines";
import { getDefaultWebstoreWarehouseId } from "./dispatch-warehouse";
import { isSkuResolved, resolveSkusBatch } from "./resolve-skus";
import { normalizePhone } from "./normalize-phone";
import type { WebstoreOrderPayload } from "./schemas";

export class NeedsReviewError extends Error {
  unresolvedSkus: string[];
  constructor(unresolvedSkus: string[]) {
    super(`SKU no disponibles para la tienda: ${unresolvedSkus.join(", ")}`);
    this.name = "NeedsReviewError";
    this.unresolvedSkus = unresolvedSkus;
  }
}

/** Payload rechazado antes de intentar resolver la orden (moneda distinta a la base configurada): el integrador debe corregir y reenviar, no es un error interno ni requiere revisión manual. */
export class UnsupportedCurrencyError extends Error {
  constructor(received: string, expected: string) {
    super(`Moneda no soportada: se recibió ${received}, se esperaba ${expected}`);
    this.name = "UnsupportedCurrencyError";
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

export interface ProcessOrderLineResult {
  sku: string;
  /** true si el precio de esta línea es estimado (catch-weight): el total real se ajusta al pesar. */
  priceIsEstimated: boolean;
  /** Peso nominal estimado (kg) de la línea, solo para líneas catch-weight. */
  estimatedWeightKg?: number;
}

export interface ProcessOrderResult {
  salesOrderId: number;
  /** null cuando la orden queda `awaiting_weighing`: aún no hay factura ni descuento de stock. */
  invoiceId: number | null;
  folio: string;
  /** "processed" (flujo normal, factura creada) o "awaiting_weighing" (contiene líneas catch-weight, pendiente de pesaje en el ERP). */
  status: "processed" | "awaiting_weighing";
  lines: ProcessOrderLineResult[];
}

export async function processWebstoreOrder(
  logId: number,
  payload: WebstoreOrderPayload,
  /** Reasignación manual sku -> productId, usada al reprocesar una orden en needs_review. */
  overrides?: Record<string, number>,
  attribution?: ProcessOrderAttribution
): Promise<ProcessOrderResult> {
  return db.$transaction(async (tx) => {
    const baseCurrency = await getBaseCurrency(tx);
    if (payload.currency !== baseCurrency.code) {
      throw new UnsupportedCurrencyError(payload.currency, baseCurrency.code);
    }

    const normalizedPhone = normalizePhone(payload.customer.phone);

    let customer = await tx.customer.findFirst({ where: { email: payload.customer.email } });
    if (!customer && normalizedPhone) {
      customer = await tx.customer.findFirst({
        where: { source: "webstore", normalizedPhone },
      });
      if (customer && !customer.email) {
        customer = await tx.customer.update({
          where: { customerId: customer.customerId },
          data: { email: payload.customer.email },
        });
      }
    }
    if (!customer) {
      customer = await tx.customer.create({
        data: {
          name: payload.customer.name,
          email: payload.customer.email,
          phone: payload.customer.phone || null,
          normalizedPhone,
          taxId: payload.customer.taxId || null,
          address: payload.customer.address || null,
          customerType: "retail",
          source: "webstore",
        },
      });
    }

    const skusNeedingLookup = payload.lines
      .filter((line) => !overrides?.[line.sku])
      .map((line) => line.sku);
    const resolvedBySku = await resolveSkusBatch(tx, skusNeedingLookup);

    const unresolvedSkus: string[] = [];
    const resolvedLines: Array<{
      sku: string;
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
          resolvedLines.push({ sku: line.sku, productId: overrideProduct.productId, quantity: line.quantity });
          continue;
        }
      }
      const product = resolvedBySku.get(line.sku);
      if (!product || !isSkuResolved(product)) {
        unresolvedSkus.push(line.sku);
        continue;
      }
      resolvedLines.push({
        sku: line.sku,
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

    // Producto isCatchWeight + presentación (piecesPerUnit) resueltos
    // server-side para decidir si la orden completa se factura de inmediato o
    // queda pendiente de pesaje. Una sola query batch, igual patrón que
    // dispatchLines.
    const uniqueProductIdsForLines = [...new Set(resolvedLines.map((l) => l.productId))];
    const productsForLines = await tx.product.findMany({
      where: { productId: { in: uniqueProductIdsForLines } },
      select: { productId: true, isCatchWeight: true },
    });
    const isCatchWeightByProductId = new Map(
      productsForLines.map((p) => [p.productId, p.isCatchWeight])
    );
    const uniquePresentationIdsForLines = [
      ...new Set(resolvedLines.map((l) => l.presentationId).filter((id): id is number => id != null)),
    ];
    const presentationsForLines = uniquePresentationIdsForLines.length
      ? await tx.productPresentation.findMany({
          where: { presentationId: { in: uniquePresentationIdsForLines } },
          select: { presentationId: true, piecesPerUnit: true },
        })
      : [];
    const piecesPerUnitByPresentationId = new Map(
      presentationsForLines.map((p) => [p.presentationId, p.piecesPerUnit])
    );

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
      sku: string;
      productId: number;
      presentationId?: number;
      quantity: number;
      unitPrice: number;
      unitFactor: number;
      baseQuantity: number;
      pieces: number | null;
      isCatchWeight: boolean;
    }> = [];
    for (const line of resolvedLines) {
      const key = lineKey(line.productId, line.presentationId);
      const price = effectivePrices.get(key);
      if (!price) throw new Error(`Producto ${line.productId} no encontrado`);
      const isCatchWeight = isCatchWeightByProductId.get(line.productId) ?? false;
      const piecesPerUnit = line.presentationId != null
        ? piecesPerUnitByPresentationId.get(line.presentationId) ?? null
        : null;

      if (isCatchWeight) {
        // Venta por unidad (pieza/caja) con precio ESTIMADO: precio por kg ×
        // peso nominal de la presentación (factor), nunca el peso real — ese
        // solo se conoce al pesar en el ERP (fulfillWebstoreOrder). Requiere
        // presentación con piecesPerUnit, igual que dispatchLines.
        if (piecesPerUnit == null || price.pricePerBase == null) {
          throw new NeedsReviewError([
            `${line.sku} (producto de peso variable sin presentación Pieza/Caja configurada)`,
          ]);
        }
        const nominalWeightKg = price.factor; // factor = peso nominal en kg (ver schema ProductPresentation)
        priced.push({
          sku: line.sku,
          productId: line.productId,
          presentationId: line.presentationId,
          quantity: line.quantity,
          unitPrice: price.pricePerBase,
          unitFactor: price.factor,
          baseQuantity: toBaseQuantity(line.quantity, nominalWeightKg),
          pieces: piecesFor(line.quantity, piecesPerUnit),
          isCatchWeight: true,
        });
        continue;
      }

      priced.push({
        sku: line.sku,
        productId: line.productId,
        presentationId: line.presentationId,
        quantity: line.quantity,
        unitPrice: price.finalPrice,
        unitFactor: price.factor,
        baseQuantity: toBaseQuantity(line.quantity, price.factor),
        pieces: null,
        isCatchWeight: false,
      });
    }

    const hasCatchWeightLines = priced.some((l) => l.isCatchWeight);

    const subtotal = priced.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const orderFolio = await nextFolio(tx, DOC_TYPES.SALES_ORDER);

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
        // presentación, igual que el comportamiento anterior. En catch-weight
        // baseQuantity es ESTIMADA (peso nominal); se corrige en
        // fulfillWebstoreOrder con el peso real.
        unitFactor: l.unitFactor,
        baseQuantity: l.baseQuantity,
        pieces: l.pieces,
      })),
    });

    const lineResultsMeta: ProcessOrderLineResult[] = priced.map((l) => ({
      sku: l.sku,
      priceIsEstimated: l.isCatchWeight,
      ...(l.isCatchWeight ? { estimatedWeightKg: l.baseQuantity } : {}),
    }));

    if (hasCatchWeightLines) {
      // Al menos una línea de peso variable: NO se crea factura ni se
      // descuenta stock aquí — el pedido queda awaiting_weighing hasta que se
      // pese en el ERP (fulfillWebstoreOrder). Precio/subtotal quedan como
      // estimación visible para el cliente y el operador.
      await tx.webstoreOrderLog.update({
        where: { logId },
        data: {
          status: "awaiting_weighing",
          salesOrderId: order.orderId,
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
          folio: orderFolio,
          status: "awaiting_weighing",
          apiKeyId: attribution?.apiKeyId,
        },
      });

      return {
        salesOrderId: order.orderId,
        invoiceId: null,
        folio: orderFolio,
        status: "awaiting_weighing",
        lines: lineResultsMeta,
      };
    }

    const invoiceFolio = await nextFolio(tx, DOC_TYPES.INVOICE);

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

    return {
      salesOrderId: order.orderId,
      invoiceId: invoice.invoiceId,
      folio: orderFolio,
      status: "processed",
      lines: lineResultsMeta,
    };
  });
}
