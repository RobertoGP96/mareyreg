"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { MobileListCard } from "@/components/ui/mobile-list-card";
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
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { type DataTableColumn } from "@/components/ui/data-table";
import {
  HandCoins, Plus, Search, MoreHorizontal, SquarePen, Trash2, Loader2,
  Hash, FileText, Calendar, CircleDollarSign, CheckCircle2, XCircle, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  createCashDelivery,
  updateCashDelivery,
  markCashDeliveryDelivered,
  cancelCashDelivery,
  deleteCashDelivery,
} from "../../actions/cash-delivery-actions";
import type { CashDeliveryRow } from "../../queries/cash-delivery-queries";
import type { RecipientPickerOption } from "../../queries/recipient-queries";
import type { CurrencyRow } from "../../lib/types";
import { CurrencyChip } from "../shared/currency-chip";
import { formatAmount } from "../../lib/format";
import { RecipientPicker } from "./recipient-picker";

type StatusFilter = "all" | "pending" | "delivered" | "cancelled";

interface Props {
  initialDeliveries: CashDeliveryRow[];
  recipients: RecipientPickerOption[];
  currencies: CurrencyRow[];
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

export function CashDeliveryListClient({ initialDeliveries, recipients, currencies }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [recipientFilter, setRecipientFilter] = useState<number | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<CashDeliveryRow | null>(null);
  const [toDelete, setToDelete] = useState<CashDeliveryRow | null>(null);
  const [toMarkDelivered, setToMarkDelivered] = useState<CashDeliveryRow | null>(null);
  const [toCancel, setToCancel] = useState<CashDeliveryRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [recipientId, setRecipientId] = useState<number | null>(null);
  const [currencyId, setCurrencyId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const activeCurrencies = useMemo(() => currencies.filter((c) => c.active), [currencies]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return initialDeliveries.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (currencyFilter !== "all" && String(d.currencyId) !== currencyFilter) return false;
      if (recipientFilter && d.recipientId !== recipientFilter) return false;
      if (!q) return true;
      return (
        d.recipientName.toLowerCase().includes(q) ||
        (d.reference ?? "").toLowerCase().includes(q) ||
        (d.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [initialDeliveries, search, statusFilter, currencyFilter, recipientFilter]);

  const totalPending = initialDeliveries.filter((d) => d.status === "pending").length;
  const totalDelivered = initialDeliveries.filter((d) => d.status === "delivered").length;
  const totalCancelled = initialDeliveries.filter((d) => d.status === "cancelled").length;

  const resetForm = () => {
    setRecipientId(null);
    setCurrencyId(activeCurrencies[0] ? String(activeCurrencies[0].currencyId) : "");
    setAmount("");
    setReference("");
    setNotes("");
  };

  const fillEdit = (d: CashDeliveryRow) => {
    setRecipientId(d.recipientId);
    setCurrencyId(String(d.currencyId));
    setAmount(d.amount);
    setReference(d.reference ?? "");
    setNotes(d.notes ?? "");
    setToEdit(d);
  };

  const validate = () => {
    if (!recipientId) return "Selecciona un destinatario";
    if (!currencyId) return "Selecciona una moneda";
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return "Monto debe ser mayor a 0";
    return null;
  };

  const handleCreate = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    const r = await createCashDelivery({
      recipientId: recipientId!,
      currencyId: Number(currencyId),
      amount: Number(amount),
      reference: reference.trim() || null,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Entrega registrada");
      setIsCreateOpen(false); resetForm(); router.refresh();
    } else toast.error(r.error);
  };

  const handleUpdate = async () => {
    if (!toEdit) return;
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    const r = await updateCashDelivery(toEdit.deliveryId, {
      recipientId: recipientId!,
      currencyId: Number(currencyId),
      amount: Number(amount),
      reference: reference.trim() || null,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Entrega actualizada");
      setToEdit(null); resetForm(); router.refresh();
    } else toast.error(r.error);
  };

  const handleMarkDelivered = async () => {
    if (!toMarkDelivered) return;
    setSubmitting(true);
    const r = await markCashDeliveryDelivered(toMarkDelivered.deliveryId);
    setSubmitting(false);
    if (r.success) {
      toast.success("Entrega confirmada");
      setToMarkDelivered(null); router.refresh();
    } else toast.error(r.error);
  };

  const handleCancel = async () => {
    if (!toCancel) return;
    setSubmitting(true);
    const r = await cancelCashDelivery(toCancel.deliveryId);
    setSubmitting(false);
    if (r.success) {
      toast.success("Entrega cancelada");
      setToCancel(null); router.refresh();
    } else toast.error(r.error);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setSubmitting(true);
    const r = await deleteCashDelivery(toDelete.deliveryId);
    setSubmitting(false);
    if (r.success) {
      toast.success("Entrega eliminada");
      setToDelete(null); router.refresh();
    } else toast.error(r.error);
  };

  const renderActions = (d: CashDeliveryRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {d.status === "pending" && (
          <>
            <DropdownMenuItem onClick={() => setToMarkDelivered(d)}>
              <CheckCircle2 className="h-4 w-4" /> Marcar entregada
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fillEdit(d)}>
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

  const columns: DataTableColumn<CashDeliveryRow>[] = [
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
      cell: (d) => (
        <span className="flex items-center justify-end gap-2">
          <span className="font-mono tabular-nums font-medium">
            {formatAmount(Number(d.amount), d.currencyDecimals)}
          </span>
          <CurrencyChip code={d.currencyCode} size="sm" />
        </span>
      ),
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
      key: "reference",
      header: "Referencia",
      cell: (d) =>
        d.reference ? (
          <span className="text-sm font-mono tabular-nums truncate">{d.reference}</span>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        ),
    },
    {
      key: "status",
      header: "Estado",
      align: "right",
      cell: (d) => (
        <StatusPill
          status={statusPillKey(d.status)}
          size="sm"
          label={STATUS_LABELS[d.status]}
        />
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

  return (
    <div className="space-y-5">
      <PageHeader
        icon={HandCoins}
        title="Entregas de efectivo"
        description="Registra entregas de efectivo a destinatarios y da seguimiento a su estado."
        badge={`${initialDeliveries.length} entregas`}
        actions={
          <Button
            variant="brand"
            onClick={() => { resetForm(); setIsCreateOpen(true); }}
            className="hidden md:inline-flex"
          >
            <Plus className="h-4 w-4" /> Nueva entrega
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-2">
        <MetricTile label="Pendientes" value={totalPending} icon={HandCoins} tone="warning" />
        <MetricTile label="Entregadas" value={totalDelivered} icon={CheckCircle2} tone="success" />
        <MetricTile label="Canceladas" value={totalCancelled} icon={XCircle} tone="critical" />
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
              <span className="flex flex-col gap-0.5">
                <span className="font-mono tabular-nums text-foreground">
                  {formatAmount(Number(d.amount), d.currencyDecimals)} {d.currencyCode}
                </span>
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
            meta={d.reference ? <span className="text-[11px] font-mono">{d.reference}</span> : null}
          />
        )}
        toolbar={
          <div className="flex flex-wrap items-center gap-2 w-full">
            <InputGroup className="flex-1 min-w-[180px] max-w-md">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput
                placeholder="Buscar por destinatario, referencia, notas…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <Badge variant="brand">{filtered.length}</Badge>
              </InputGroupAddon>
            </InputGroup>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="delivered">Entregadas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
              <SelectTrigger className="w-[140px]">
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
              <SelectTrigger className="w-[180px]">
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
          </div>
        }
        emptyState={
          <EmptyState
            title="Sin entregas"
            description={
              search || statusFilter !== "all" || currencyFilter !== "all" || recipientFilter
                ? "No hay coincidencias con los filtros aplicados."
                : "Registra la primera entrega de efectivo."
            }
          />
        }
      />

      <ResponsiveFormDialog
        open={isCreateOpen || !!toEdit}
        onOpenChange={(o) => {
          if (!o) {
            setIsCreateOpen(false); setToEdit(null); resetForm();
          }
        }}
        a11yTitle={toEdit ? "Editar entrega" : "Nueva entrega de efectivo"}
        description="Selecciona destinatario, moneda y monto."
        desktopMaxWidth="sm:max-w-lg"
      >
        <FormDialogHeader
          icon={HandCoins}
          title={toEdit ? "Editar entrega" : "Nueva entrega de efectivo"}
          description="Selecciona destinatario, moneda y monto."
        />
        <div className="space-y-4 mt-4">
          <FormSection icon={HandCoins} title="Destinatario">
            <Field label="Destinatario" required hint="Selecciona uno existente o crea uno nuevo desde el botón.">
              <RecipientPicker
                recipients={recipients}
                value={recipientId}
                onChange={(r) => setRecipientId(r ? r.recipientId : null)}
              />
            </Field>
          </FormSection>

          <FormSection icon={CircleDollarSign} title="Monto y moneda">
            <Field label="Moneda" icon={CircleDollarSign} required>
              <Select value={currencyId} onValueChange={setCurrencyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona moneda" />
                </SelectTrigger>
                <SelectContent>
                  {activeCurrencies.map((c) => (
                    <SelectItem key={c.currencyId} value={String(c.currencyId)}>
                      {c.code} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Monto" icon={Hash} required>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono tabular-nums"
              />
            </Field>
          </FormSection>

          <FormSection icon={FileText} title="Detalles">
            <Field label="Referencia" icon={Hash} hint="Folio, comprobante, ticket…">
              <Input
                placeholder="REF-001"
                value={reference}
                maxLength={80}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
            <Field label="Notas" icon={FileText}>
              <Textarea
                placeholder="Información adicional sobre la entrega"
                value={notes}
                rows={2}
                maxLength={500}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </FormSection>

          {toEdit && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Solo se pueden editar entregas con estado pendiente.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setIsCreateOpen(false); setToEdit(null); resetForm(); }}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="brand"
            onClick={toEdit ? handleUpdate : handleCreate}
            disabled={submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Guardando…" : toEdit ? "Actualizar" : "Registrar"}
          </Button>
        </div>
      </ResponsiveFormDialog>

      <AlertDialog open={!!toMarkDelivered} onOpenChange={() => setToMarkDelivered(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar como entregada?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma que se entregaron{" "}
              <span className="font-mono tabular-nums">
                {toMarkDelivered ? `${formatAmount(Number(toMarkDelivered.amount), toMarkDelivered.currencyDecimals)} ${toMarkDelivered.currencyCode}` : ""}
              </span>{" "}
              a {toMarkDelivered?.recipientName}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkDelivered} disabled={submitting}>
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
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
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
              Se eliminará permanentemente este registro. Las entregas confirmadas no pueden eliminarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={submitting || toDelete?.status === "delivered"}
            >
              {submitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Fab
        icon={Plus}
        label="Nueva entrega"
        onClick={() => { resetForm(); setIsCreateOpen(true); }}
      />
    </div>
  );
}
