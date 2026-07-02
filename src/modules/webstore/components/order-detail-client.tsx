"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, type OpsStatus } from "@/components/ui/status-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Receipt, RefreshCw, Loader2, AlertTriangle, CheckCircle2, Ban } from "lucide-react";
import { toast } from "@/lib/toast";
import { reprocessOrder, cancelWebstoreOrder } from "../actions/order-actions";

const STATUS_MAP: Record<string, { status: OpsStatus; label: string }> = {
  received: { status: "pending", label: "Recibida" },
  processed: { status: "completed", label: "Procesada" },
  needs_review: { status: "delayed", label: "Requiere revisión" },
  error: { status: "cancelled", label: "Error" },
  cancelled: { status: "cancelled", label: "Cancelada" },
};

interface OrderLogDetail {
  logId: number;
  externalOrderId: string;
  status: string;
  errorMessage: string | null;
  receivedAt: string;
  processedAt: string | null;
  apiKeyLabel: string;
  salesOrderFolio: string | null;
  invoiceFolio: string | null;
  invoiceTotal: number | null;
  invoiceStatus: string | null;
  rawPayload: unknown;
}

interface LineStatus {
  sku: string;
  quantity: number;
  unitPrice: number;
  resolved: boolean;
}

interface ProductOption {
  productId: number;
  name: string;
  sku: string | null;
}

export function OrderDetailClient({
  log,
  lineStatuses,
  products,
  stockMovements,
}: {
  log: OrderLogDetail;
  lineStatuses: LineStatus[];
  products: ProductOption[];
  stockMovements: Array<{ movementId: number; productId: number; quantity: number }>;
}) {
  const router = useRouter();
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const cfg = STATUS_MAP[log.status] ?? { status: "pending" as OpsStatus, label: log.status };
  const needsAttention = log.status === "needs_review" || log.status === "error";
  const canCancel = log.status === "processed";

  const handleReprocess = async () => {
    setIsReprocessing(true);
    const overrideMap: Record<string, number> = {};
    for (const [sku, productId] of Object.entries(overrides)) {
      if (productId) overrideMap[sku] = Number(productId);
    }
    const result = await reprocessOrder(log.logId, overrideMap);
    setIsReprocessing(false);
    if (result.success) {
      toast.success(`Orden procesada — folio ${result.data.folio}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    const result = await cancelWebstoreOrder(log.logId);
    setIsCancelling(false);
    setConfirmCancel(false);
    if (result.success) {
      toast.success("Orden cancelada — stock, pagos y saldo revertidos");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Receipt}
        title={`Orden ${log.externalOrderId}`}
        description={`Recibida el ${new Date(log.receivedAt).toLocaleString("es-MX")} vía ${log.apiKeyLabel}`}
        meta={<StatusPill status={cfg.status} label={cfg.label} />}
        actions={
          <>
            {needsAttention && (
              <Button variant="brand" onClick={handleReprocess} disabled={isReprocessing}>
                {isReprocessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isReprocessing ? "Reprocesando…" : "Reprocesar"}
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmCancel(true)}
                disabled={isCancelling}
              >
                {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                {isCancelling ? "Cancelando…" : "Cancelar orden"}
              </Button>
            )}
          </>
        }
      />

      {log.errorMessage && (
        <div className="rounded-lg border border-[var(--ops-warning)]/30 bg-[var(--ops-warning)]/10 p-3 text-sm text-[var(--ops-warning)] flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{log.errorMessage}</span>
        </div>
      )}

      {log.status === "processed" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card p-3 text-sm">
            <div className="text-muted-foreground text-xs mb-1">Orden de venta</div>
            <div className="font-mono font-semibold">{log.salesOrderFolio}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-sm">
            <div className="text-muted-foreground text-xs mb-1">Factura</div>
            <div className="font-mono font-semibold">
              {log.invoiceFolio} — ${log.invoiceTotal?.toFixed(2)}{" "}
              <Badge variant="outline" className="ml-1">{log.invoiceStatus}</Badge>
            </div>
          </div>
        </div>
      )}

      <FormSection icon={Receipt} title="Líneas del pedido" description="Productos solicitados y su resolución en Mareyway.">
        <div className="space-y-2">
          {lineStatuses.map((line) => (
            <div key={line.sku} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex-1 min-w-0 text-sm">
                <span className="font-mono">{line.sku}</span> · {line.quantity} u. · ${line.unitPrice.toFixed(2)}
              </div>
              {line.resolved ? (
                <Badge variant="info" className="w-fit"><CheckCircle2 className="h-3 w-3" /> Resuelto</Badge>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="w-fit">Sin resolver</Badge>
                  {needsAttention && (
                    <Select
                      value={overrides[line.sku] ?? ""}
                      onValueChange={(v) => setOverrides((prev) => ({ ...prev, [line.sku]: v }))}
                    >
                      <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Reasignar producto..." /></SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {products.map((p) => (
                          <SelectItem key={p.productId} value={String(p.productId)}>
                            {p.name}{p.sku ? ` (${p.sku})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </FormSection>

      {stockMovements.length > 0 && (
        <FormSection title="Movimientos de inventario" description="Salidas de stock generadas por esta venta.">
          <div className="space-y-1 text-sm">
            {stockMovements.map((m) => (
              <div key={m.movementId} className="flex justify-between text-muted-foreground">
                <span>Producto #{m.productId}</span>
                <span className="font-mono tabular-nums">-{m.quantity}</span>
              </div>
            ))}
          </div>
        </FormSection>
      )}

      <FormSection title="Payload crudo" description="Datos originales recibidos de la tienda.">
        <Field label="">
          <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs">
            {JSON.stringify(log.rawPayload, null, 2)}
          </pre>
        </Field>
      </FormSection>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta orden?</AlertDialogTitle>
            <AlertDialogDescription>
              Se revertirá el stock y la valuación de los productos vendidos, se anulará cualquier
              pago registrado y se ajustará el saldo del cliente. La factura{" "}
              <strong>{log.invoiceFolio}</strong> quedará marcada como cancelada. Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isCancelling}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isCancelling ? "Cancelando…" : "Sí, cancelar orden"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
