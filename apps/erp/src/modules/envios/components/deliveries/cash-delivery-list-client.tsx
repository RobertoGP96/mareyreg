"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { MobileFilterSheet } from "@/components/ui/mobile-filter-sheet";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { Fab } from "@/components/ui/fab";
import { StatusPill } from "@/components/ui/status-pill";
import { MetricTile } from "@/components/ui/metric-tile";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type DataTableColumn } from "@/components/ui/data-table";
import {
  HandCoins, Plus, Search, MoreHorizontal, SquarePen, Trash2, Loader2, Bike,
  CheckCircle2, XCircle, ExternalLink, BadgeDollarSign, Undo2, Image as ImageIcon, Check,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  createCashDelivery,
  updateCashDelivery,
  markCashDeliveryDelivered,
  cancelCashDelivery,
  deleteCashDelivery,
  markDeliveryCommissionPaid,
  markDeliveryCommissionPending,
  bulkMarkCommissionPaid,
} from "../../actions/cash-delivery-actions";
import { getCashDeliveryDetail } from "../../actions/cash-delivery-detail-action";
import type {
  CashDeliveryDetail,
  CashDeliveryRow,
} from "../../queries/cash-delivery-queries";
import type { RecipientPickerOption } from "../../queries/recipient-queries";
import type { CourierPickerOption } from "../../queries/courier-queries";
import type { ActiveDenomination } from "../../queries/currency-denomination-queries";
import type { CurrencyRow } from "../../lib/types";
import type { CashDeliveryInput } from "../../lib/schemas";
import { CurrencyChip } from "../shared/currency-chip";
import { formatAmount } from "../../lib/format";
import { CashDeliveryForm } from "./cash-delivery-form";

type StatusFilter = "all" | "pending" | "delivered" | "cancelled";
type CommissionFilter = "all" | "pending" | "paid";

interface Props {
  initialDeliveries: CashDeliveryRow[];
  recipients: RecipientPickerOption[];
  couriers: CourierPickerOption[];
  currencies: CurrencyRow[];
  denominationsByCurrency: Record<number, ActiveDenomination[]>;
  isAdmin: boolean;
}

const STATUS_LABELS: Record<"pending" | "delivered" | "cancelled", string> = {
  pending: "Pendiente",
  delivered: "Entregada",
  cancelled: "Cancelada",
};

function statusPillKey(s: "pending" | "delivered" | "cancelled") {
  if (s === "delivered") return "completed" as const;
  if (s === "cancelled") return "cancelled" as const;
  return "pending" as const;
}

function hasCommission(d: CashDeliveryRow) {
  return Number(d.commissionAmount) > 0 && d.courierId != null;
}

function AmountLines({ d, compact }: { d: CashDeliveryRow; compact?: boolean }) {
  const shown = compact ? d.lines.slice(0, 2) : d.lines;
  return (
    <span className="flex flex-col items-end gap-0.5">
      {shown.map((l) => (
        <span key={l.lineId} className="flex items-center gap-1.5">
          <span className="font-mono tabular-nums font-medium">
            {formatAmount(Number(l.amount), l.currencyDecimals)}
          </span>
          <CurrencyChip code={l.currencyCode} size="sm" />
        </span>
      ))}
      {compact && d.lines.length > 2 && (
        <span className="text-[11px] text-muted-foreground">+{d.lines.length - 2} más</span>
      )}
    </span>
  );
}

export function CashDeliveryListClient({
  initialDeliveries,
  recipients,
  couriers,
  currencies,
  denominationsByCurrency,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [recipientFilter, setRecipientFilter] = useState<number | null>(null);
  const [courierFilter, setCourierFilter] = useState<string>("all");
  const [commissionFilter, setCommissionFilter] = useState<CommissionFilter>("all");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<CashDeliveryDetail | null>(null);
  const [toDelete, setToDelete] = useState<CashDeliveryRow | null>(null);
  const [toMarkDelivered, setToMarkDelivered] = useState<CashDeliveryRow | null>(null);
  const [toCancel, setToCancel] = useState<CashDeliveryRow | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return initialDeliveries.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (currencyFilter !== "all" && !d.lines.some((l) => String(l.currencyId) === currencyFilter))
        return false;
      if (recipientFilter && d.recipientId !== recipientFilter) return false;
      if (courierFilter !== "all" && String(d.courierId ?? "") !== courierFilter) return false;
      if (commissionFilter !== "all") {
        if (!hasCommission(d)) return false;
        if (d.commissionStatus !== commissionFilter) return false;
      }
      if (!q) return true;
      return (
        d.recipientName.toLowerCase().includes(q) ||
        (d.courierName ?? "").toLowerCase().includes(q) ||
        (d.reference ?? "").toLowerCase().includes(q) ||
        (d.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [
    initialDeliveries, search, statusFilter, currencyFilter,
    recipientFilter, courierFilter, commissionFilter,
  ]);

  const totalPending = initialDeliveries.filter((d) => d.status === "pending").length;
  const totalDelivered = initialDeliveries.filter((d) => d.status === "delivered").length;
  const totalCancelled = initialDeliveries.filter((d) => d.status === "cancelled").length;
  const commissionPendingCount = initialDeliveries.filter(
    (d) => hasCommission(d) && d.commissionStatus === "pending" && d.status !== "cancelled"
  ).length;

  const selectableIds = useMemo(
    () =>
      filtered
        .filter(
          (d) =>
            hasCommission(d) && d.commissionStatus === "pending" && d.status !== "cancelled"
        )
        .map((d) => d.deliveryId),
    [filtered]
  );

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (currencyFilter !== "all" ? 1 : 0) +
    (recipientFilter ? 1 : 0) +
    (courierFilter !== "all" ? 1 : 0) +
    (commissionFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter("all");
    setCurrencyFilter("all");
    setRecipientFilter(null);
    setCourierFilter("all");
    setCommissionFilter("all");
  };

  const openCreate = () => {
    setEditing(null);
    setIsFormOpen(true);
  };

  const openEdit = async (d: CashDeliveryRow) => {
    // La lista no trae el desglose (sería un include de 3 niveles sobre 200
    // filas); el detalle se pide al abrir el formulario.
    const detail = await getCashDeliveryDetail(d.deliveryId);
    if (!detail.success) {
      toast.error(detail.error);
      return;
    }
    setEditing(detail.data);
    setIsFormOpen(true);
  };

  const handleSubmit = async (input: CashDeliveryInput): Promise<boolean> => {
    const r = editing
      ? await updateCashDelivery(editing.deliveryId, input)
      : await createCashDelivery(input);
    if (r.success) {
      toast.success(editing ? "Entrega actualizada" : "Entrega registrada");
      router.refresh();
      return true;
    }
    toast.error(r.error);
    return false;
  };

  const runAction = async (
    fn: () => Promise<{ success: boolean; error?: string }>,
    successMessage: string,
    onDone: () => void
  ) => {
    setSubmitting(true);
    try {
      const r = await fn();
      if (r.success) {
        toast.success(successMessage);
        onDone();
        router.refresh();
      } else {
        toast.error(r.error ?? "Ocurrió un error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkPaid = async () => {
    setSubmitting(true);
    try {
      const r = await bulkMarkCommissionPaid([...selected]);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      const { paid, failed } = r.data;
      if (failed.length === 0) {
        toast.success(`${paid} comisiones marcadas como pagadas`);
      } else {
        toast.error(
          `${paid} pagadas, ${failed.length} con error: ${failed
            .slice(0, 3)
            .map((f) => `#${f.id} ${f.error}`)
            .join(" · ")}`
        );
      }
      setSelected(new Set());
      setShowBulkConfirm(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelected = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderActions = (d: CashDeliveryRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {d.status === "pending" && (
          <>
            <DropdownMenuItem onClick={() => setToMarkDelivered(d)}>
              <CheckCircle2 className="h-4 w-4" /> Marcar entregada
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void openEdit(d)}>
              <SquarePen className="h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setToCancel(d)}
              className="text-destructive focus:text-destructive"
            >
              <XCircle className="h-4 w-4" /> Cancelar
            </DropdownMenuItem>
          </>
        )}
        {hasCommission(d) && d.commissionStatus === "pending" && d.status !== "cancelled" && (
          <DropdownMenuItem
            onClick={() =>
              runAction(
                () => markDeliveryCommissionPaid(d.deliveryId),
                "Comisión marcada como pagada",
                () => undefined
              )
            }
          >
            <BadgeDollarSign className="h-4 w-4" /> Marcar comisión pagada
          </DropdownMenuItem>
        )}
        {isAdmin && hasCommission(d) && d.commissionStatus === "paid" && (
          <DropdownMenuItem
            onClick={() =>
              runAction(
                () => markDeliveryCommissionPending(d.deliveryId),
                "Comisión revertida",
                () => undefined
              )
            }
          >
            <Undo2 className="h-4 w-4" /> Revertir comisión
          </DropdownMenuItem>
        )}
        {d.photoUrl && (
          <DropdownMenuItem
            onClick={() => window.open(d.photoUrl!, "_blank", "noopener,noreferrer")}
          >
            <ImageIcon className="h-4 w-4" /> Ver foto
          </DropdownMenuItem>
        )}
        {d.recipientMapUrl && (
          <DropdownMenuItem
            onClick={() => window.open(d.recipientMapUrl!, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-4 w-4" /> Abrir mapa
          </DropdownMenuItem>
        )}
        {d.status !== "delivered" && (
          <DropdownMenuItem
            onClick={() => setToDelete(d)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Eliminar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderCommission = (d: CashDeliveryRow) => {
    if (!hasCommission(d)) {
      return <span className="text-xs text-muted-foreground italic">—</span>;
    }
    return (
      <span className="flex items-center justify-end gap-2">
        <span className="font-mono tabular-nums">
          {formatAmount(
            Number(d.commissionAmount),
            d.commissionCurrencyDecimals ?? 2
          )}{" "}
          {d.commissionCurrencyCode}
        </span>
        <StatusPill
          status={d.commissionStatus === "paid" ? "completed" : "pending"}
          size="sm"
          label={d.commissionStatus === "paid" ? "Pagada" : "Pendiente"}
        />
      </span>
    );
  };

  const columns: DataTableColumn<CashDeliveryRow>[] = [
    {
      key: "select",
      header: "",
      width: "w-10",
      cell: (d) =>
        selectableIds.includes(d.deliveryId) ? (
          <Checkbox
            checked={selected.has(d.deliveryId)}
            onCheckedChange={() => toggleSelected(d.deliveryId)}
            aria-label={`Seleccionar entrega a ${d.recipientName}`}
          />
        ) : null,
    },
    {
      key: "recipient",
      header: "Destinatario",
      cell: (d) => (
        <div className="flex flex-col min-w-0">
          <span className="font-medium text-foreground truncate">{d.recipientName}</span>
          {d.recipientPhone && (
            <span className="text-xs text-muted-foreground truncate">{d.recipientPhone}</span>
          )}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Monto",
      align: "right",
      cell: (d) => <AmountLines d={d} />,
    },
    {
      key: "courier",
      header: "Mensajero",
      cell: (d) =>
        d.courierName ? (
          <span className="text-sm truncate">{d.courierName}</span>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        ),
    },
    {
      key: "commission",
      header: "Comisión",
      align: "right",
      cell: renderCommission,
    },
    {
      key: "occurredAt",
      header: "Fecha",
      cell: (d) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {new Date(d.occurredAt).toLocaleString("es-MX", {
            year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      align: "right",
      cell: (d) => (
        <StatusPill status={statusPillKey(d.status)} size="sm" label={STATUS_LABELS[d.status]} />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-12",
      cell: (d) => renderActions(d),
    },
  ];

  const filterControls = (
    <>
      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <SelectTrigger className="w-full md:w-[150px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="pending">Pendientes</SelectItem>
          <SelectItem value="delivered">Entregadas</SelectItem>
          <SelectItem value="cancelled">Canceladas</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={commissionFilter}
        onValueChange={(v) => setCommissionFilter(v as CommissionFilter)}
      >
        <SelectTrigger className="w-full md:w-[170px]">
          <SelectValue placeholder="Comisión" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toda comisión</SelectItem>
          <SelectItem value="pending">Comisión pendiente</SelectItem>
          <SelectItem value="paid">Comisión pagada</SelectItem>
        </SelectContent>
      </Select>
      <Select value={courierFilter} onValueChange={setCourierFilter}>
        <SelectTrigger className="w-full md:w-[170px]">
          <SelectValue placeholder="Mensajero" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los mensajeros</SelectItem>
          {couriers.map((c) => (
            <SelectItem key={c.courierProfileId} value={String(c.courierProfileId)}>
              {c.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
        <SelectTrigger className="w-full md:w-[150px]">
          <SelectValue placeholder="Moneda" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las monedas</SelectItem>
          {currencies.map((c) => (
            <SelectItem key={c.currencyId} value={String(c.currencyId)}>
              {c.code} · {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={recipientFilter ? String(recipientFilter) : "all"}
        onValueChange={(v) => setRecipientFilter(v === "all" ? null : Number(v))}
      >
        <SelectTrigger className="w-full md:w-[180px]">
          <SelectValue placeholder="Destinatario" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los destinatarios</SelectItem>
          {recipients.map((r) => (
            <SelectItem key={r.recipientId} value={String(r.recipientId)}>
              {r.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Entregas de efectivo"
        description="Registra entregas de efectivo a destinatarios y da seguimiento a su estado y a la comisión del mensajero."
        badge={`${initialDeliveries.length} entregas`}
        actions={
          <Button variant="brand" onClick={openCreate} className="hidden md:inline-flex">
            <Plus className="h-4 w-4" /> Nueva entrega
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <MetricTile label="Pendientes" value={totalPending} icon={HandCoins} tone="warning" />
        <MetricTile label="Entregadas" value={totalDelivered} icon={CheckCircle2} tone="success" />
        <MetricTile label="Canceladas" value={totalCancelled} icon={XCircle} tone="critical" />
        <MetricTile
          label="Comisión por pagar"
          value={commissionPendingCount}
          icon={Bike}
          tone="warning"
        />
      </div>

      <ResponsiveListView<CashDeliveryRow>
        columns={columns}
        rows={filtered}
        rowKey={(d) => d.deliveryId}
        mobileCard={(d) => (
          <MobileListCard
            key={d.deliveryId}
            title={
              <span className="flex items-center gap-2 min-w-0">
                <HandCoins className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{d.recipientName}</span>
              </span>
            }
            subtitle={
              <span className="flex flex-col gap-0.5 items-start">
                <AmountLines d={d} compact />
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {new Date(d.occurredAt).toLocaleString("es-MX", {
                    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </span>
            }
            value={
              <StatusPill
                status={statusPillKey(d.status)}
                size="sm"
                label={STATUS_LABELS[d.status]}
              />
            }
            actions={renderActions(d)}
            meta={
              <span className="flex flex-wrap items-center gap-2">
                {d.courierName && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Bike className="h-3 w-3" /> {d.courierName}
                  </span>
                )}
                {hasCommission(d) && (
                  <StatusPill
                    status={d.commissionStatus === "paid" ? "completed" : "pending"}
                    size="sm"
                    label={`Comisión ${d.commissionStatus === "paid" ? "pagada" : "pendiente"}`}
                  />
                )}
                {d.reference && <span className="text-[11px] font-mono">{d.reference}</span>}
              </span>
            }
          />
        )}
        toolbar={
          <div className="flex flex-wrap items-center gap-2 w-full">
            <InputGroup className="flex-1 min-w-[180px] max-w-md">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput
                placeholder="Buscar por destinatario, mensajero, referencia…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <Badge variant="brand">{filtered.length}</Badge>
              </InputGroupAddon>
            </InputGroup>
            <div className="md:hidden">
              <MobileFilterSheet activeCount={activeFilterCount} onClear={clearFilters}>
                <div className="flex flex-col gap-3">{filterControls}</div>
              </MobileFilterSheet>
            </div>
            <div className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
              {filterControls}
            </div>
          </div>
        }
        emptyState={
          <EmptyState
            title="Sin entregas"
            description={
              search || activeFilterCount > 0
                ? "No hay coincidencias con los filtros aplicados."
                : "Registra la primera entrega de efectivo."
            }
          />
        }
      />

      {selected.size > 0 && (
        <div
          className={cn(
            "fixed left-1/2 -translate-x-1/2 z-30 bottom-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+5rem)] md:bottom-6",
            "flex items-center gap-3 px-4 py-2.5 rounded-xl",
            "bg-[var(--brand)] text-[var(--brand-foreground)] shadow-lg ring-1 ring-[var(--brand)]/40"
          )}
        >
          <span className="text-sm font-medium">{selected.size} seleccionadas</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowBulkConfirm(true)}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Marcar pagadas
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-[var(--brand-foreground)] hover:bg-white/10"
            onClick={() => setSelected(new Set())}
          >
            Limpiar
          </Button>
        </div>
      )}

      <CashDeliveryForm
        open={isFormOpen}
        onOpenChange={(o) => {
          setIsFormOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        recipients={recipients}
        couriers={couriers}
        currencies={currencies}
        denominationsByCurrency={denominationsByCurrency}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar {selected.size} comisiones como pagadas</AlertDialogTitle>
            <AlertDialogDescription>
              Cada comisión se marca en una transacción independiente. Si alguna falla (ya
              pagada, entrega cancelada) se reporta y las demás continúan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkPaid} disabled={submitting}>
              {submitting ? "Marcando…" : `Marcar ${selected.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toMarkDelivered} onOpenChange={() => setToMarkDelivered(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar como entregada?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma que se entregaron{" "}
              <span className="font-mono tabular-nums">
                {toMarkDelivered?.lines
                  .map(
                    (l) =>
                      `${formatAmount(Number(l.amount), l.currencyDecimals)} ${l.currencyCode}`
                  )
                  .join(" + ")}
              </span>{" "}
              a {toMarkDelivered?.recipientName}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                runAction(
                  () => markCashDeliveryDelivered(toMarkDelivered!.deliveryId),
                  "Entrega confirmada",
                  () => setToMarkDelivered(null)
                )
              }
              disabled={submitting}
            >
              {submitting ? "Confirmando…" : "Confirmar entrega"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toCancel} onOpenChange={() => setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar entrega?</AlertDialogTitle>
            <AlertDialogDescription>
              Se marcará como cancelada la entrega a {toCancel?.recipientName}.
              {toCancel?.commissionStatus === "paid" &&
                " La comisión ya pagada volverá a quedar pendiente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                runAction(
                  () => cancelCashDelivery(toCancel!.deliveryId),
                  "Entrega cancelada",
                  () => setToCancel(null)
                )
              }
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={submitting}
            >
              {submitting ? "Cancelando…" : "Cancelar entrega"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar entrega?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente este registro con todos sus montos y desglose. Las
              entregas confirmadas no pueden eliminarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                runAction(
                  () => deleteCashDelivery(toDelete!.deliveryId),
                  "Entrega eliminada",
                  () => setToDelete(null)
                )
              }
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={submitting || toDelete?.status === "delivered"}
            >
              {submitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Fab icon={Plus} label="Nueva entrega" onClick={openCreate} />
    </div>
  );
}
