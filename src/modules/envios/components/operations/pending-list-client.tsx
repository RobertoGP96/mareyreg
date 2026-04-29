"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { MetricTile } from "@/components/ui/metric-tile";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { type DataTableColumn } from "@/components/ui/data-table";
import {
  Clock, Check, Ban, CircleCheck, X, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { confirmOperation, cancelOperation } from "../../actions/operation-actions";
import { bulkConfirmOperations } from "../../actions/transfer-actions";
import type { OperationRow } from "../../lib/types";
import { CurrencyChip } from "../shared/currency-chip";
import { AmountDisplay } from "../shared/amount-display";
import { OpTypeBadge } from "../shared/op-type-badge";

interface Props {
  initialPending: OperationRow[];
  summary: Array<{ currencyId: number; code: string; decimalPlaces: number; type: string; count: number; total: number }>;
}

export function PendingListClient({ initialPending, summary }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const filtered = initialPending;

  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, { code: string; net: number; decimalPlaces: number; count: number }>();
    for (const o of initialPending) {
      const sign =
        o.type === "withdrawal" || o.type === "transfer_out" ? -o.amount
          : o.type === "deposit" || o.type === "transfer_in" ? +o.amount
            : o.amount;
      const key = o.currencyCode;
      const prev = map.get(key);
      if (prev) { prev.net += sign; prev.count += 1; }
      else map.set(key, { code: o.currencyCode, net: sign, decimalPlaces: o.currencyDecimals, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [initialPending]);

  const allSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.operationId));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((o) => o.operationId)));
  };
  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmOne = async (op: OperationRow) => {
    const r = await confirmOperation(op.operationId);
    if (r.success) { toast.success("Confirmada"); router.refresh(); }
    else toast.error(r.error);
  };
  const handleCancelOne = async (op: OperationRow) => {
    const r = await cancelOperation(op.operationId);
    if (r.success) { toast.success("Cancelada"); router.refresh(); }
    else toast.error(r.error);
  };
  const handleBulkConfirm = async () => {
    setSubmitting(true);
    const r = await bulkConfirmOperations(Array.from(selected));
    setSubmitting(false);
    setShowBulkConfirm(false);
    if (r.success) {
      const { confirmed, failed } = r.data;
      if (failed.length === 0) {
        toast.success(`${confirmed} operación(es) confirmadas`);
      } else {
        toast.warning(`${confirmed} confirmadas · ${failed.length} con error`, {
          description: failed.slice(0, 3).map((f) => `#${f.id}: ${f.error}`).join(" · "),
        });
      }
      setSelected(new Set());
      router.refresh();
    } else toast.error(r.error);
  };

  const renderAmount = (o: OperationRow) => {
    const sign = o.type === "withdrawal" || o.type === "transfer_out"
      ? -o.amount
      : o.type === "deposit" || o.type === "transfer_in"
        ? +o.amount
        : o.amount;
    return (
      <div className="flex items-center gap-1.5 justify-end">
        <AmountDisplay value={sign} decimalPlaces={o.currencyDecimals} showSign signed />
        <CurrencyChip code={o.currencyCode} size="sm" />
      </div>
    );
  };

  const columns: DataTableColumn<OperationRow>[] = [
    {
      key: "select",
      header: (
        <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Seleccionar todas" />
      ) as unknown as string,
      width: "w-10",
      cell: (o) => (
        <Checkbox
          checked={selected.has(o.operationId)}
          onCheckedChange={() => toggleOne(o.operationId)}
          aria-label="Seleccionar"
        />
      ),
    },
    {
      key: "type",
      header: "Tipo",
      cell: (o) => <OpTypeBadge type={o.type} />,
    },
    {
      key: "account",
      header: "Cuenta",
      cell: (o) => (
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-medium text-foreground truncate">{o.accountName}</span>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">{o.groupName}</span>
        </div>
      ),
    },
    {
      key: "description",
      header: "Detalle",
      cell: (o) => (
        <span className="text-xs text-muted-foreground line-clamp-1">{o.description ?? o.reference ?? "—"}</span>
      ),
    },
    {
      key: "amount",
      header: "Monto",
      align: "right",
      cell: renderAmount,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-24",
      cell: (o) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => handleConfirmOne(o)} aria-label="Confirmar">
            <Check className="h-4 w-4 text-[var(--ops-success)]" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => handleCancelOne(o)} aria-label="Cancelar">
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Clock}
        title="Pendientes"
        description="Operaciones registradas que aún no afectan el saldo. Confírmalas individualmente o en lote."
        badge={`${initialPending.length} pendientes`}
        actions={
          selected.size > 0 ? (
            <Button
              variant="brand"
              onClick={() => setShowBulkConfirm(true)}
            >
              <Check className="h-4 w-4" /> Confirmar {selected.size}
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MetricTile label="Total" value={initialPending.length} icon={Clock} tone="warning" />
        {totalsByCurrency.slice(0, 3).map((t) => (
          <MetricTile
            key={t.code}
            label={`Neto ${t.code}`}
            value={t.net.toLocaleString("es-MX", {
              minimumFractionDigits: t.decimalPlaces,
              maximumFractionDigits: t.decimalPlaces,
            })}
            icon={Clock}
            tone={t.net < 0 ? "warning" : "success"}
          />
        ))}
      </div>

      <ResponsiveListView<OperationRow>
        columns={columns}
        rows={filtered}
        rowKey={(o) => o.operationId}
        mobileCard={(o) => (
          <MobileListCard
            key={o.operationId}
            title={
              <span className="flex items-center gap-2">
                <Checkbox
                  checked={selected.has(o.operationId)}
                  onCheckedChange={() => toggleOne(o.operationId)}
                  aria-label="Seleccionar"
                />
                <OpTypeBadge type={o.type} />
                <span className="truncate font-medium">{o.accountName}</span>
              </span>
            }
            subtitle={o.groupName}
            value={renderAmount(o)}
            actions={
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-9" onClick={() => handleConfirmOne(o)} aria-label="Confirmar">
                  <Check className="h-4 w-4 text-[var(--ops-success)]" />
                </Button>
                <Button variant="ghost" size="icon" className="size-9" onClick={() => handleCancelOne(o)} aria-label="Cancelar">
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            }
            meta={o.description ? <span className="text-[11px] text-muted-foreground line-clamp-1">{o.description}</span> : null}
          />
        )}
        toolbar={
          <div className="text-xs text-muted-foreground">
            {summary.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {summary.map((s, i) => (
                  <Badge key={`${s.currencyId}-${s.type}-${i}`} variant="outline" className="text-[10px] font-mono tabular-nums">
                    {s.code} · {s.type}: {s.count} ({s.total.toLocaleString("es-MX", { minimumFractionDigits: s.decimalPlaces, maximumFractionDigits: s.decimalPlaces })})
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        }
        emptyState={
          <EmptyState
            icon={<CircleCheck className="size-10 text-[var(--ops-success)]" />}
            title="Todo confirmado"
            description="No hay operaciones pendientes por revisar."
          />
        }
      />

      {/* Sticky bulk-confirm bar */}
      {selected.size > 0 ? (
        <div
          className={cn(
            "fixed left-1/2 -translate-x-1/2 z-30 bottom-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+1rem)] md:bottom-6",
            "flex items-center gap-3 px-4 py-2.5 rounded-xl",
            "bg-[var(--brand)] text-[var(--brand-foreground)] shadow-lg ring-1 ring-[var(--brand)]/40"
          )}
        >
          <span className="text-sm font-medium">{selected.size} seleccionadas</span>
          <Button size="sm" variant="secondary" onClick={() => setShowBulkConfirm(true)} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Confirmar
          </Button>
          <Button size="sm" variant="ghost" className="text-[var(--brand-foreground)] hover:bg-white/10" onClick={() => setSelected(new Set())}>
            Limpiar
          </Button>
        </div>
      ) : null}

      <AlertDialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar {selected.size} operaciones</AlertDialogTitle>
            <AlertDialogDescription>
              Cada operación se aplicará a su cuenta dentro de una transacción independiente. Si alguna no tiene saldo suficiente, se reportará y las demás continuarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkConfirm}
              className="bg-[var(--ops-success)] text-white hover:bg-[var(--ops-success)]/90"
              disabled={submitting}
            >
              {submitting ? "Confirmando…" : `Confirmar ${selected.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
