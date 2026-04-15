export const dynamic = "force-dynamic";

import { getPurchaseOrder } from "@/modules/purchasing/queries/purchase-queries";
import { ReceiptClient } from "@/modules/purchasing/components/receipt-client";
import { notFound, redirect } from "next/navigation";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const po = await getPurchaseOrder(Number(id));
  if (!po) notFound();
  if (po.status === "received" || po.status === "cancelled") {
    redirect(`/purchase-orders/${po.poId}`);
  }

  return <ReceiptClient poId={po.poId} folio={po.folio} lines={po.lines} />;
}
