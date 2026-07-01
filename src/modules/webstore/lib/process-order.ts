import { db } from "@/lib/db";
import { nextFolio, DOC_TYPES } from "@/lib/folio";
import { applyInventoryExit } from "@/lib/valuation";
import { createAuditLog } from "@/lib/audit";
import { getEffectivePrice } from "@/modules/inventory/lib/effective-price";
import type { Prisma } from "@/generated/prisma";
import type { WebstoreOrderPayload } from "./schemas";

type PrismaTx = Prisma.TransactionClient;

export class NeedsReviewError extends Error {
  unresolvedSkus: string[];
  constructor(unresolvedSkus: string[]) {
    super(`SKU no disponibles para la tienda: ${unresolvedSkus.join(", ")}`);
    this.name = "NeedsReviewError";
    this.unresolvedSkus = unresolvedSkus;
  }
}

async function dispatchWebstoreLines(
  tx: PrismaTx,
  params: {
    invoiceId: number;
    folio: string;
    warehouseId: number;
    lines: Array<{ productId: number; quantity: number; unitPrice: number }>;
  }
) {
  const lineResults: Array<{
    productId: number;
    quantity: number;
    unitPrice: number;
    discount: number;
    unitCost: number;
    subtotal: number;
  }> = [];

  for (const line of params.lines) {
    const product = await tx.product.findUniqueOrThrow({ where: { productId: line.productId } });
    let unitCost = 0;

    if (!product.isService) {
      if (!product.allowNegative) {
        const level = await tx.stockLevel.findUnique({
          where: {
            productId_warehouseId: { productId: line.productId, warehouseId: params.warehouseId },
          },
        });
        const current = level ? Number(level.currentQuantity) : 0;
        if (current < line.quantity) {
          throw new Error(
            `Stock insuficiente para ${product.name}. Disponible: ${current}, solicitado: ${line.quantity}`
          );
        }
      }

      const exit = await applyInventoryExit(tx, {
        productId: line.productId,
        warehouseId: params.warehouseId,
        qty: line.quantity,
      });
      unitCost = exit.avgCostUsed;

      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          warehouseId: params.warehouseId,
          quantity: line.quantity,
          movementType: "exit",
          unitCost,
          referenceDoc: params.folio,
          notes: `Venta tienda en línea ${params.folio}`,
        },
      });

      await tx.stockLevel.update({
        where: {
          productId_warehouseId: { productId: line.productId, warehouseId: params.warehouseId },
        },
        data: { currentQuantity: { decrement: line.quantity }, lastUpdated: new Date() },
      });
    }

    lineResults.push({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: 0,
      unitCost,
      subtotal: line.quantity * line.unitPrice,
    });
  }

  await tx.invoiceLine.createMany({
    data: lineResults.map((r) => ({ invoiceId: params.invoiceId, ...r })),
  });

  return lineResults;
}

export async function processWebstoreOrder(
  logId: number,
  payload: WebstoreOrderPayload,
  /** Reasignación manual sku -> productId, usada al reprocesar una orden en needs_review. */
  overrides?: Record<string, number>
): Promise<{ salesOrderId: number; invoiceId: number; folio: string }> {
  return db.$transaction(async (tx) => {
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

    const unresolvedSkus: string[] = [];
    const resolvedLines: Array<{ productId: number; quantity: number }> = [];
    for (const line of payload.lines) {
      const overrideProductId = overrides?.[line.sku];
      if (overrideProductId) {
        const overrideProduct = await tx.product.findUnique({ where: { productId: overrideProductId } });
        if (overrideProduct && overrideProduct.isActive) {
          resolvedLines.push({ productId: overrideProduct.productId, quantity: line.quantity });
          continue;
        }
      }
      const product = await tx.product.findUnique({ where: { sku: line.sku } });
      if (!product || !product.isActive || !product.webstoreEnabled) {
        unresolvedSkus.push(line.sku);
        continue;
      }
      resolvedLines.push({ productId: product.productId, quantity: line.quantity });
    }
    if (unresolvedSkus.length > 0) {
      throw new NeedsReviewError(unresolvedSkus);
    }

    let warehouseId = payload.warehouseId;
    if (!warehouseId) {
      const defaultWarehouse = await tx.warehouse.findFirst({
        where: { isActive: true },
        orderBy: { warehouseId: "asc" },
      });
      if (!defaultWarehouse) throw new Error("No hay almacenes activos configurados");
      warehouseId = defaultWarehouse.warehouseId;
    }

    const priced: Array<{ productId: number; quantity: number; unitPrice: number }> = [];
    for (const line of resolvedLines) {
      const price = await getEffectivePrice(tx, {
        productId: line.productId,
        quantity: line.quantity,
        customerId: customer.customerId,
      });
      priced.push({ productId: line.productId, quantity: line.quantity, unitPrice: price.finalPrice });
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
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: 0,
        fulfilledQty: l.quantity,
        subtotal: l.quantity * l.unitPrice,
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

    await dispatchWebstoreLines(tx, {
      invoiceId: invoice.invoiceId,
      folio: invoiceFolio,
      warehouseId,
      lines: priced,
    });

    await tx.customer.update({
      where: { customerId: customer.customerId },
      data: { currentBalance: { increment: subtotal } },
    });

    if (payload.payment) {
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
      newValues: {
        externalOrderId: payload.externalOrderId,
        salesOrderId: order.orderId,
        invoiceId: invoice.invoiceId,
        folio: orderFolio,
      },
    });

    return { salesOrderId: order.orderId, invoiceId: invoice.invoiceId, folio: orderFolio };
  });
}
