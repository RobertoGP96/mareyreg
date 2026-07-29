export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrderLogById } from "@/modules/webstore/queries/order-log-queries";
import { getProducts } from "@/modules/inventory/queries/product-queries";
import { webstoreOrderPayloadSchema } from "@/modules/webstore/lib/schemas";
import { isSkuResolved, resolveSkusBatch } from "@/modules/webstore/lib/resolve-skus";
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

  let lineStatuses: Array<{ sku: string; quantity: number; unitPrice: number; resolved: boolean }> = [];
  if (payload) {
    const resolvedBySku = await resolveSkusBatch(
      db,
      payload.lines.map((line) => line.sku)
    );
    lineStatuses = payload.lines.map((line) => {
      const product = resolvedBySku.get(line.sku);
      const resolved = !!product && isSkuResolved(product);
      return { sku: line.sku, quantity: line.quantity, unitPrice: line.unitPrice, resolved };
    });
  }

  const needsAttention = log.status === "needs_review" || log.status === "error";
  const products = needsAttention ? await getProducts() : [];

  const stockMovements = log.invoice?.folio
    ? await db.stockMovement.findMany({ where: { referenceDoc: log.invoice.folio } })
    : [];

  // Piezas reservadas por el cliente en la tienda: esas líneas ya tienen peso
  // real y el formulario de pesaje las muestra en solo lectura.
  const orderLineIds = (log.salesOrder?.lines ?? []).map((l) => l.lineId);
  const reservedPieces = orderLineIds.length
    ? await db.productPiece.findMany({
        where: { salesOrderLineId: { in: orderLineIds }, status: "reserved" },
        select: { pieceId: true, salesOrderLineId: true, weightKg: true, label: true },
      })
    : [];
  const reservedByLineId = new Map<
    number,
    Array<{ pieceId: number; weightKg: number; label: string | null }>
  >();
  for (const piece of reservedPieces) {
    const list = reservedByLineId.get(piece.salesOrderLineId!) ?? [];
    list.push({ pieceId: piece.pieceId, weightKg: Number(piece.weightKg), label: piece.label });
    reservedByLineId.set(piece.salesOrderLineId!, list);
  }

  const catchWeightLines = (log.salesOrder?.lines ?? [])
    .filter((l) => l.product.isCatchWeight && l.pieces != null)
    .map((l) => ({
      orderLineId: l.lineId,
      productName: l.product.name,
      presentationName: l.presentation?.name ?? null,
      pieces: l.pieces as number,
      estimatedWeightKg: Number(l.baseQuantity),
      pricePerKg: Number(l.unitPrice),
      reservedPieces: reservedByLineId.get(l.lineId) ?? [],
    }));

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
          salesOrderId: log.salesOrder?.orderId ?? null,
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
        catchWeightLines={catchWeightLines}
      />
    </div>
  );
}
