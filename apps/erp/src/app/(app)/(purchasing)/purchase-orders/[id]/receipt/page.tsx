export const dynamic = "force-dynamic";

import { getPurchaseOrder } from "@/modules/purchasing/queries/purchase-queries";
import { ReceiptClient } from "@/modules/purchasing/components/receipt-client";
import { getRateToBase } from "@/lib/currency";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const po = await getPurchaseOrder(Number(id));
  if (!po) notFound();
  if (po.status === "received" || po.status === "cancelled") {
    redirect(`/purchase-orders/${po.poId}`);
  }

  // Tasa vigente que se aplicara al recibir (solo informativa; el server
  // vuelve a resolverla dentro de la transaccion de createGoodsReceipt).
  let pendingRate: { code: string; rate: number } | null = null;
  if (po.currencyId) {
    try {
      const snapshot = await getRateToBase(db, po.currencyId);
      pendingRate = { code: po.currency!.code, rate: snapshot.rate };
    } catch {
      pendingRate = { code: po.currency!.code, rate: NaN };
    }
  }

  return (
    <ReceiptClient poId={po.poId} folio={po.folio} lines={po.lines} pendingRate={pendingRate} />
  );
}
