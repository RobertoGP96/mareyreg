export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrderLogById } from "@/modules/webstore/queries/order-log-queries";
import { getProducts } from "@/modules/inventory/queries/product-queries";
import { webstoreOrderPayloadSchema } from "@/modules/webstore/lib/schemas";
import { OrderDetailClient } from "@/modules/webstore/components/order-detail-client";

export default async function WebstoreOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const logId = Number(id);
  const log = await getOrderLogById(logId);
  if (!log) notFound();

  const parsed = webstoreOrderPayloadSchema.safeParse(log.rawPayload);
  const payload = parsed.success ? parsed.data : null;

  const lineStatuses = payload
    ? await Promise.all(
        payload.lines.map(async (line) => {
          const product = await db.product.findUnique({ where: { sku: line.sku } });
          const resolved = !!product && product.isActive && product.webstoreEnabled;
          return { sku: line.sku, quantity: line.quantity, unitPrice: line.unitPrice, resolved };
        })
      )
    : [];

  const needsAttention = log.status === "needs_review" || log.status === "error";
  const products = needsAttention ? await getProducts() : [];

  const stockMovements = log.invoice?.folio
    ? await db.stockMovement.findMany({ where: { referenceDoc: log.invoice.folio } })
    : [];

  return (
    <div className="space-y-4">
      <OrderDetailClient
        log={{
          logId: log.logId,
          externalOrderId: log.externalOrderId,
          status: log.status,
          errorMessage: log.errorMessage,
          receivedAt: log.receivedAt.toISOString(),
          processedAt: log.processedAt ? log.processedAt.toISOString() : null,
          apiKeyLabel: log.apiKey.label,
          salesOrderFolio: log.salesOrder?.folio ?? null,
          invoiceFolio: log.invoice?.folio ?? null,
          invoiceTotal: log.invoice ? Number(log.invoice.total) : null,
          invoiceStatus: log.invoice?.status ?? null,
          rawPayload: log.rawPayload,
        }}
        lineStatuses={lineStatuses}
        products={products.map((p) => ({ productId: p.productId, name: p.name, sku: p.sku }))}
        stockMovements={stockMovements.map((m) => ({
          movementId: m.movementId,
          productId: m.productId,
          quantity: Number(m.quantity),
        }))}
      />
    </div>
  );
}
