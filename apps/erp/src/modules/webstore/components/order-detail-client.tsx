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
import { Receipt, RefreshCw, Loader2, AlertTriangle, CheckCircle2, Ban, Scale } from "lucide-react";
import { toast } from "@/lib/toast";
import { ToastDetail, ToastLines } from "@/components/ui/toast-content";
import { Input } from "@/components/ui/input";
import { reprocessOrder, cancelWebstoreOrder } from "../actions/order-actions";
import { fulfillWebstoreOrder } from "../actions/fulfill-order-actions";

const STATUS_MAP: Record<string, { status: OpsStatus; label: string }> = {
  received: { status: "pending", label: "Recibida" },
  processed: { status: "completed", label: "Procesada" },
  needs_review: { status: "delayed", label: "Requiere revisión" },
  error: { status: "cancelled", label: "Error" },
  cancelled: { status: "cancelled", label: "Cancelada" },
  awaiting_weighing: { status: "delayed", label: "Por pesar" },
};

interface OrderLogDetail {
  logId: number;
  externalOrderId: string;
  status: string;
  errorMessage: string | null;
  receivedAt: string;
  processedAt: string | null;
  apiKeyLabel: string;
  salesOrderId: number | null;
  salesOrderFolio: string | null;
  invoiceFolio: string | null;
  invoiceTotal: number | null;
  invoiceStatus: string | null;
  rawPayload: unknown;
}

interface CatchWeightLine {
  orderLineId: number;
  productName: string;
  presentationName: string | null;
  pieces: number;
  estimatedWeightKg: number;
  pricePerKg: number;
  /** Piezas elegidas por el cliente en la tienda: el peso ya es real, no se captura. */
  reservedPieces: Array<{ pieceId: number; weightKg: number; label: string | null }>;
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
  catchWeightLines,
}: {
  log: OrderLogDetail;
  lineStatuses: LineStatus[];
  products: ProductOption[];
  stockMovements: Array<{ movementId: number; productId: number; quantity: number }>;
  catchWeightLines: CatchWeightLine[];
}) {
  const router = useRouter();
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<Record<number, string>>({});

  const cfg = STATUS_MAP[log.status] ?? { status: "pending" as OpsStatus, label: log.status };
  const needsAttention = log.status === "needs_review" || log.status === "error";
  const canCancel = log.status === "processed" || log.status === "awaiting_weighing";
  const isAwaitingWeighing = log.status === "awaiting_weighing";

  const reservedWeightFor = (line: CatchWeightLine) =>
    line.reservedPieces.reduce((s, p) => s + p.weightKg, 0);

  const weighingTotal = catchWeightLines.reduce((sum, line) => {
    if (line.reservedPieces.length > 0) {
      return sum + reservedWeightFor(line) * line.pricePerKg;
    }
    const w = Number(weights[line.orderLineId]);
    const weight = Number.isFinite(w) && w > 0 ? w : line.estimatedWeightKg;
    return sum + weight * line.pricePerKg;
  }, 0);

  const handleFulfill = async () => {
    // Las líneas con piezas reservadas no capturan peso: el server lo deriva
    // de los registros. Solo se validan/envían las líneas sin piezas.
    const linesNeedingWeight = catchWeightLines.filter((l) => l.reservedPieces.length === 0);
    const parsedWeights = linesNeedingWeight.map((line) => ({
      orderLineId: line.orderLineId,
      actualWeightKg: Number(weights[line.orderLineId]),
    }));
    const missing = parsedWeights.find((w) => !Number.isFinite(w.actualWeightKg) || w.actualWeightKg <= 0);
    if (missing) {
      toast.error("Captura el peso real de todas las líneas antes de facturar");
      return;
    }
    if (!log.salesOrderId) return;

    setIsFulfilling(true);
    const result = await fulfillWebstoreOrder({ orderId: log.salesOrderId, weights: parsedWeights });
    setIsFulfilling(false);
    if (result.success) {
      toast.success(`Pedido pesado y facturado — folio ${result.data.folio}`, {
        description: (
          <ToastLines>
            <ToastDetail label="Total real" value={`$${result.data.total.toFixed(2)}`} mono />
          </ToastLines>
        ),
      });
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    const overrideMap: Record<string, number> = {};
    for (const [sku, productId] of Object.entries(overrides)) {
      if (productId) overrideMap[sku] = Number(productId);
    }
    const result = await reprocessOrder(log.logId, overrideMap);
    setIsReprocessing(false);
    if (result.success) {
      const orderTotal = lineStatuses.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      toast.success(`Orden procesada — folio ${result.data.folio}`, {
        description: (
          <ToastLines>
            <ToastDetail
              label={`${lineStatuses.length} ${lineStatuses.length === 1 ? "artículo" : "artículos"}`}
              value={`$${orderTotal.toFixed(2)}`}
              mono
            />
          </ToastLines>
        ),
      });
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

      {isAwaitingWeighing && catchWeightLines.length > 0 && (
        <FormSection
          icon={Scale}
          title="Pesaje de productos de peso variable"
          description="Captura el peso real de cada línea para facturar el pedido. El precio mostrado es por kg."
        >
          <div className="space-y-3">
            {catchWeightLines.map((line) => {
              const hasReserved = line.reservedPieces.length > 0;
              const rawWeight = weights[line.orderLineId] ?? "";
              const parsedWeight = Number(rawWeight);
              const lineTotal = hasReserved
                ? reservedWeightFor(line) * line.pricePerKg
                : Number.isFinite(parsedWeight) && parsedWeight > 0
                  ? parsedWeight * line.pricePerKg
                  : null;
              return (
                <div key={line.orderLineId} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div>
                      <span className="font-medium">{line.productName}</span>
                      {line.presentationName && (
                        <span className="text-muted-foreground"> · {line.presentationName}</span>
                      )}
                      <span className="text-muted-foreground"> · {line.pieces} pzas</span>
                    </div>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      ${line.pricePerKg.toFixed(2)} / kg
                    </span>
                  </div>
                  {hasReserved ? (
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="space-y-0.5">
                        {line.reservedPieces.map((p) => (
                          <p key={p.pieceId} className="font-mono tabular-nums text-muted-foreground">
                            Pieza {p.label ?? `#${p.pieceId}`} · {p.weightKg.toFixed(3)} kg
                            <span className="text-xs"> — elegida por el cliente</span>
                          </p>
                        ))}
                      </div>
                      <div className="text-sm font-mono tabular-nums whitespace-nowrap">
                        ${lineTotal!.toFixed(2)}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Field label="Peso real (kg)" className="flex-1">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          inputMode="decimal"
                          placeholder={line.estimatedWeightKg.toFixed(3)}
                          value={rawWeight}
                          onChange={(e) =>
                            setWeights((prev) => ({ ...prev, [line.orderLineId]: e.target.value }))
                          }
                        />
                      </Field>
                      <div className="text-sm font-mono tabular-nums whitespace-nowrap pt-5">
                        {lineTotal != null ? `$${lineTotal.toFixed(2)}` : "—"}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm font-semibold">
              <span>Total estimado</span>
              <span className="font-mono tabular-nums">${weighingTotal.toFixed(2)}</span>
            </div>
            <Button variant="brand" onClick={handleFulfill} disabled={isFulfilling} className="w-full sm:w-auto">
              {isFulfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
              {isFulfilling ? "Facturando…" : "Pesar y facturar"}
            </Button>
          </div>
        </FormSection>
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
              {isAwaitingWeighing ? (
                <>
                  El pedido aún no está facturado: se cancelará la orden de venta y las piezas
                  reservadas por el cliente volverán a estar disponibles. Esta acción no se puede
                  deshacer.
                </>
              ) : (
                <>
                  Se revertirá el stock y la valuación de los productos vendidos, se anulará
                  cualquier pago registrado y se ajustará el saldo del cliente. La factura{" "}
                  <strong>{log.invoiceFolio}</strong> quedará marcada como cancelada. Esta acción no
                  se puede deshacer.
                </>
              )}
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
