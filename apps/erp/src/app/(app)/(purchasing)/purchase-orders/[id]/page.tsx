export const dynamic = "force-dynamic";

import { getPurchaseOrder } from "@/modules/purchasing/queries/purchase-queries";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PackageCheck } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  partial: "bg-yellow-100 text-yellow-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const po = await getPurchaseOrder(Number(id));
  if (!po) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">OC {po.folio}</h1>
          <div className="text-muted-foreground mt-1 flex gap-3 flex-wrap">
            <Badge className={STATUS_COLORS[po.status]}>{po.status}</Badge>
            <span>Proveedor: {po.supplier.name}</span>
            <span>Almacen: {po.warehouse.name}</span>
            <span>Fecha: {new Date(po.orderDate).toLocaleDateString("es-ES")}</span>
          </div>
        </div>
        {(po.status === "sent" || po.status === "partial") && (
          <Button asChild>
            <Link href={`/purchase-orders/${po.poId}/receipt`}>
              <PackageCheck className="w-4 h-4 mr-2" /> Registrar recepcion
            </Link>
          </Button>
        )}
      </div>

      <div className="bg-card border rounded-lg">
        <div className="px-4 py-3 border-b">
          <h2 className="font-medium">Lineas</h2>
        </div>
        <div className="p-4 grid gap-2">
          {po.lines.map((l) => {
            const pending = Number(l.quantity) - Number(l.receivedQty);
            return (
              <div key={l.lineId} className="flex flex-wrap items-center justify-between gap-2 border rounded px-3 py-2">
                <div>
                  <p className="font-medium">{l.product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {String(l.quantity)} {l.product.unit} x ${String(l.unitCost)} = ${(Number(l.quantity) * Number(l.unitCost)).toFixed(2)}
                  </p>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Recibido: </span>
                  <span className="font-medium">{String(l.receivedQty)}</span>
                  {pending > 0 && <span className="ml-2 text-yellow-700">Pendiente: {pending}</span>}
                </div>
              </div>
            );
          })}
          <div className="flex justify-end text-sm mt-2">
            <span>Total: <span className="font-semibold text-base">${String(po.total)}</span></span>
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-lg">
        <div className="px-4 py-3 border-b">
          <h2 className="font-medium">Recepciones ({po.receipts.length})</h2>
        </div>
        <div className="p-4 grid gap-2">
          {po.receipts.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin recepciones registradas.</p>
          )}
          {po.receipts.map((r) => (
            <div key={r.receiptId} className="border rounded px-3 py-2">
              <div className="flex justify-between">
                <p className="font-medium">{r.folio}</p>
                <span className="text-sm text-muted-foreground">
                  {new Date(r.receivedAt).toLocaleString("es-ES")}
                </span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {r.lines.map((rl) => (
                  <div key={rl.lineId}>
                    {rl.poLine.product.name}: {String(rl.quantity)} {rl.lot && <span>(Lote {rl.lot.code})</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
