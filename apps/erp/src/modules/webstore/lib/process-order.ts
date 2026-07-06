import { db } from "@/lib/db";
import { nextFolio, DOC_TYPES } from "@/lib/folio";
import { createAuditLog } from "@/lib/audit";
import { getBaseCurrency } from "@/lib/currency";
import { getEffectiveLinePrices, lineKey } from "@/modules/inventory/lib/effective-price";
import { toBaseQuantity, piecesFor, catchWeightBaseQuantity } from "@/modules/inventory/lib/units";
import { dispatchLines } from "@/modules/sales/lib/dispatch-lines";
import { getDefaultWebstoreWarehouseId } from "./dispatch-warehouse";
import { piecePrice } from "./piece-price";
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

/**
 * Piezas elegidas por el cliente que ya no están disponibles (vendidas en POS
 * o reservadas por otro pedido entre el carrito y el checkout). Mapea a
 * 409 pieces_unavailable: la tienda quita esas piezas del carrito y pide
 * re-elegir — nunca se degrada silenciosamente a awaiting_weighing porque el
 * cliente vio un precio exacto por una pieza concreta.
 */
export class PiecesUnavailableError extends Error {
  unavailable: Array<{ sku: string; pieceIds: number[] }>;
  constructor(unavailable: Array<{ sku: string; pieceIds: number[] }>) {
    super("Algunas piezas ya no están disponibles");
    this.name = "PiecesUnavailableError";
    this.unavailable = unavailable;
  }
}

/** pieceIds que no corresponden al producto/almacén/presentación de su línea: payload inválido (400), error del integrador. */
export class InvalidPiecesError extends Error {
  constructor(sku: string, pieceIds: number[]) {
    super(`Piezas inválidas para ${sku}: ${pieceIds.join(", ")}`);
    this.name = "InvalidPiecesError";
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
  /** true si el precio de esta línea es estimado (catch-weight sin piezas): el total real se ajusta al pesar. */
  priceIsEstimated: boolean;
  /** Peso nominal estimado (kg) de la línea, solo para líneas catch-weight estimadas. */
  estimatedWeightKg?: number;
  /** Eco de las piezas asignadas a la línea (catch-weight con pieceIds): el peso ya es real. */
  pieces?: Array<{ pieceId: number; weightKg: number }>;
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
      pieceIds?: number[];
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
        pieceIds: line.pieceIds,
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

    // Batch de las piezas pedidas por el cliente (una sola query). La lectura
    // valida pertenencia y disponibilidad; el claim atómico (más abajo) es la
    // barrera real contra carreras.
    const allRequestedPieceIds = resolvedLines.flatMap((l) => l.pieceIds ?? []);
    const requestedPieces = allRequestedPieceIds.length
      ? await tx.productPiece.findMany({ where: { pieceId: { in: allRequestedPieceIds } } })
      : [];
    const requestedPieceById = new Map(requestedPieces.map((p) => [p.pieceId, p]));

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
      /** true cuando el peso ya es real (piezas elegidas): no requiere pesaje. */
      hasRealWeight: boolean;
      pieceIds?: number[];
      /** Subtotal de la línea con el MISMO redondeo que vio el cliente en la tienda. */
      lineSubtotal: number;
    }> = [];
    const unavailablePieces: Array<{ sku: string; pieceIds: number[] }> = [];

    for (const line of resolvedLines) {
      const key = lineKey(line.productId, line.presentationId);
      const price = effectivePrices.get(key);
      if (!price) throw new Error(`Producto ${line.productId} no encontrado`);
      const isCatchWeight = isCatchWeightByProductId.get(line.productId) ?? false;
      const piecesPerUnit = line.presentationId != null
        ? piecesPerUnitByPresentationId.get(line.presentationId) ?? null
        : null;

      if (!isCatchWeight && line.pieceIds?.length) {
        throw new InvalidPiecesError(line.sku, line.pieceIds);
      }

      if (isCatchWeight) {
        if (piecesPerUnit == null || price.pricePerBase == null) {
          throw new NeedsReviewError([
            `${line.sku} (producto de peso variable sin presentación Pieza/Caja configurada)`,
          ]);
        }

        if (line.pieceIds?.length) {
          // Piezas elegidas por el cliente: el peso real sale de los registros
          // server-side y el precio por pieza usa piecePrice — el mismo
          // redondeo que mostró el catálogo.
          const wrong = line.pieceIds.filter((id) => {
            const pc = requestedPieceById.get(id);
            return (
              pc != null &&
              (pc.productId !== line.productId ||
                pc.warehouseId !== warehouseId ||
                pc.pieceCount !== piecesPerUnit)
            );
          });
          if (wrong.length) throw new InvalidPiecesError(line.sku, wrong);

          const notAvailable = line.pieceIds.filter((id) => {
            const pc = requestedPieceById.get(id);
            return !pc || pc.status !== "available";
          });
          if (notAvailable.length) {
            unavailablePieces.push({ sku: line.sku, pieceIds: notAvailable });
            continue;
          }

          const selected = line.pieceIds.map((id) => requestedPieceById.get(id)!);
          const totalWeightKg = catchWeightBaseQuantity(
            selected.reduce((s, p) => s + Number(p.weightKg), 0)
          );
          const lineSubtotal = selected.reduce(
            (s, p) => s + piecePrice(price.pricePerBase!, Number(p.weightKg), baseCurrency.decimalPlaces),
            0
          );
          priced.push({
            sku: line.sku,
            productId: line.productId,
            presentationId: line.presentationId,
            quantity: line.quantity,
            unitPrice: price.pricePerBase,
            unitFactor: price.factor,
            baseQuantity: totalWeightKg,
            pieces: selected.reduce((s, p) => s + p.pieceCount, 0),
            isCatchWeight: true,
            hasRealWeight: true,
            pieceIds: line.pieceIds,
            lineSubtotal,
          });
          continue;
        }

        // Venta por unidad (pieza/caja) con precio ESTIMADO: precio por kg ×
        // peso nominal de la presentación (factor), nunca el peso real — ese
        // solo se conoce al pesar en el ERP (fulfillWebstoreOrder). Requiere
        // presentación con piecesPerUnit, igual que dispatchLines.
        const nominalWeightKg = price.factor; // factor = peso nominal en kg (ver schema ProductPresentation)
        const baseQuantity = toBaseQuantity(line.quantity, nominalWeightKg);
        priced.push({
          sku: line.sku,
          productId: line.productId,
          presentationId: line.presentationId,
          quantity: line.quantity,
          unitPrice: price.pricePerBase,
          unitFactor: price.factor,
          baseQuantity,
          pieces: piecesFor(line.quantity, piecesPerUnit),
          isCatchWeight: true,
          hasRealWeight: false,
          lineSubtotal: piecePrice(price.pricePerBase, baseQuantity, baseCurrency.decimalPlaces),
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
        hasRealWeight: false,
        lineSubtotal: line.quantity * price.finalPrice,
      });
    }

    if (unavailablePieces.length > 0) {
      throw new PiecesUnavailableError(unavailablePieces);
    }

    // Claim atómico available → reserved por línea con piezas: si otra venta
    // (POS u otro pedido) ganó alguna pieza entre la lectura y este update,
    // count no coincide y toda la tx se revierte (las piezas parcialmente
    // reclamadas vuelven solas con el rollback).
    for (const line of priced) {
      if (!line.pieceIds?.length) continue;
      const claim = await tx.productPiece.updateMany({
        where: {
          pieceId: { in: line.pieceIds },
          productId: line.productId,
          warehouseId,
          status: "available",
        },
        data: { status: "reserved", reservedAt: new Date() },
      });
      if (claim.count !== line.pieceIds.length) {
        throw new PiecesUnavailableError([{ sku: line.sku, pieceIds: line.pieceIds }]);
      }
    }

    // Solo las líneas catch-weight SIN peso real (sin piezas elegidas) mandan
    // el pedido a awaiting_weighing; con piezas el peso ya se conoce y se
    // factura de inmediato.
    const hasUnweighedCatchWeightLines = priced.some(
      (l) => l.isCatchWeight && !l.hasRealWeight
    );

    const subtotal = priced.reduce((s, l) => s + l.lineSubtotal, 0);
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

    // Create por línea (no createMany): las líneas con piezas necesitan su
    // lineId para anclar la reserva (salesOrderLineId) — así fulfill/cancel
    // encuentran las piezas del pedido y dispatchLines puede consumir piezas
    // reserved sin poder robar reservas de otros pedidos.
    const orderLineIds: number[] = [];
    for (const l of priced) {
      const createdLine = await tx.salesOrderLine.create({
        data: {
          orderId: order.orderId,
          productId: l.productId,
          presentationId: l.presentationId ?? null,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: 0,
          fulfilledQty: l.quantity,
          subtotal: l.lineSubtotal,
          // factor/baseQuantity resueltos server-side (ver getEffectiveLinePrices
          // arriba): 1 y quantity respectivamente cuando la línea no trae
          // presentación, igual que el comportamiento anterior. En catch-weight
          // sin piezas baseQuantity es ESTIMADA (peso nominal) y se corrige en
          // fulfillWebstoreOrder; con piezas ya es el peso real registrado.
          unitFactor: l.unitFactor,
          baseQuantity: l.baseQuantity,
          pieces: l.pieces,
        },
      });
      orderLineIds.push(createdLine.lineId);
      if (l.pieceIds?.length) {
        await tx.productPiece.updateMany({
          where: { pieceId: { in: l.pieceIds } },
          data: { salesOrderLineId: createdLine.lineId },
        });
      }
    }

    const lineResultsMeta: ProcessOrderLineResult[] = priced.map((l) => ({
      sku: l.sku,
      priceIsEstimated: l.isCatchWeight && !l.hasRealWeight,
      ...(l.isCatchWeight && !l.hasRealWeight ? { estimatedWeightKg: l.baseQuantity } : {}),
      ...(l.pieceIds?.length
        ? {
            pieces: l.pieceIds.map((id) => ({
              pieceId: id,
              weightKg: Number(requestedPieceById.get(id)!.weightKg),
            })),
          }
        : {}),
    }));

    if (hasUnweighedCatchWeightLines) {
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

    // Las líneas con piezas viajan con pieceIds + salesOrderLineId: dispatchLines
    // deriva el peso real de los registros y consume las piezas reservadas por
    // este mismo pedido (reserved → sold + invoiceLineId). Nota: el subtotal de
    // InvoiceLine que calcula dispatchLines (peso × precio/kg sin redondear por
    // pieza) puede diferir centavos del lineSubtotal redondeado; el total
    // cobrado (Invoice.total) usa SIEMPRE el subtotal redondeado que vio el
    // cliente.
    await dispatchLines(tx, {
      invoiceId: invoice.invoiceId,
      folio: invoiceFolio,
      warehouseId,
      customerId: customer.customerId,
      lines: priced.map((l, idx) => ({
        productId: l.productId,
        presentationId: l.presentationId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        pieceIds: l.pieceIds,
        salesOrderLineId: l.pieceIds?.length ? orderLineIds[idx] : undefined,
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
