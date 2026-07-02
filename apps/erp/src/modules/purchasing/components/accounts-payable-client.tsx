"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { ToastDetail, ToastLines, ToastNote } from "@/components/ui/toast-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { MobileFilterSheet } from "@/components/ui/mobile-filter-sheet";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { Fab } from "@/components/ui/fab";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { type DataTableColumn } from "@/components/ui/data-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Plus,
  Search,
  Receipt,
  Wallet,
  AlertTriangle,
  CalendarDays,
  Building2,
  Hash,
  CreditCard,
  FileStack,
  ListFilter,
  Loader2,
  Ban,
  HandCoins,
  FileSpreadsheet,
} from "lucide-react";
import { createSupplierBill, registerSupplierPayment, cancelSupplierBill } from "../actions/supplier-bill-actions";
import type { SupplierBillListItem } from "../queries/supplier-bill-queries";

interface SupplierOption {
  supplierId: number;
  name: string;
  taxId: string | null;
}

interface ReceivedPoOption {
  poId: number;
  folio: string;
  supplierId: number;
  supplierName: string;
  orderDate: string;
  total: number;
}

interface Summary {
  totalOwed: number;
  totalOverdue: number;
  totalPaidThisMonth: number;
  openCount: number;
  overdueCount: number;
}

interface Props {
  bills: SupplierBillListItem[];
  suppliers: SupplierOption[];
  receivablePOs: ReceivedPoOption[];
  summary: Summary;
}

const ALL = "__all__";
const PAYMENT_METHODS = [
  { value: "transfer", label: "Transferencia" },
  { value: "cash", label: "Efectivo" },
  { value: "check", label: "Cheque" },
  { value: "card", label: "Tarjeta" },
  { value: "other", label: "Otro" },
];

function money(n: number): string {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusToPill(status: SupplierBillListItem["status"], isOverdue: boolean) {
  if (status === "cancelled") return <StatusPill status="cancelled" />;
  if (status === "paid") return <StatusPill status="paid" />;
  if (isOverdue) return <StatusPill status="delayed" label="Vencida" />;
  if (status === "partial") return <StatusPill status="pending" label="Parcial" />;
  return <StatusPill status="pending" label="Abierta" />;
}

export function AccountsPayableClient({ bills, suppliers, receivablePOs, summary }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [supplierFilter, setSupplierFilter] = useState<string>(ALL);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFromPoOpen, setIsFromPoOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<SupplierBillListItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SupplierBillListItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return bills.filter((b) => {
      if (statusFilter !== ALL) {
        if (statusFilter === "overdue" && !b.isOverdue) return false;
        if (statusFilter !== "overdue" && b.status !== statusFilter) return false;
      }
      if (supplierFilter !== ALL && String(b.supplierId) !== supplierFilter) return false;
      if (!q) return true;
      return (
        b.folio.toLowerCase().includes(q) ||
        b.supplierName.toLowerCase().includes(q) ||
        (b.purchaseOrderFolio?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [bills, search, statusFilter, supplierFilter]);

  const activeFilters = (statusFilter !== ALL ? 1 : 0) + (supplierFilter !== ALL ? 1 : 0);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const total = Number(fd.get("total"));
    const result = await createSupplierBill({
      supplierId: Number(fd.get("supplierId")),
      issueDate: fd.get("issueDate") as string,
      dueDate: (fd.get("dueDate") as string) || undefined,
      total,
      notes: (fd.get("notes") as string) || undefined,
    });
    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      toast.success(`Factura ${result.data.folio} creada`, {
        description: (
          <ToastLines>
            <ToastDetail label="Total" value={`$${money(total)}`} mono />
          </ToastLines>
        ),
      });
      router.refresh();
    } else toast.error(result.error);
  };

  const handleCreateFromPo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const poId = Number(fd.get("poId"));
    const po = receivablePOs.find((p) => p.poId === poId);
    if (!po) {
      setIsSubmitting(false);
      toast.error("Selecciona una OC valida");
      return;
    }
    const result = await createSupplierBill({
      supplierId: po.supplierId,
      purchaseOrderId: po.poId,
      issueDate: fd.get("issueDate") as string,
      dueDate: (fd.get("dueDate") as string) || undefined,
      total: po.total,
      notes: (fd.get("notes") as string) || undefined,
    });
    setIsSubmitting(false);
    if (result.success) {
      setIsFromPoOpen(false);
      toast.success(`Factura ${result.data.folio} generada desde ${po.folio}`, {
        description: (
          <ToastLines>
            <ToastDetail label="Total" value={`$${money(po.total)}`} mono />
          </ToastLines>
        ),
      });
      router.refresh();
    } else toast.error(result.error);
  };

  const handlePay = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!payTarget) return;
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    const method = fd.get("method") as string;
    const result = await registerSupplierPayment({
      billId: payTarget.billId,
      amount,
      method,
      paymentDate: fd.get("paymentDate") as string,
      notes: (fd.get("notes") as string) || undefined,
    });
    setIsSubmitting(false);
    if (result.success) {
      setPayTarget(null);
      const methodLabel = PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
      toast.success("Pago registrado", {
        description: (
          <ToastLines>
            <ToastDetail label={`Factura ${payTarget.folio}`} value={`$${money(amount)}`} mono />
            <ToastNote>{methodLabel}</ToastNote>
          </ToastLines>
        ),
      });
      router.refresh();
    } else toast.error(result.error);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setIsSubmitting(true);
    const result = await cancelSupplierBill(cancelTarget.billId);
    setIsSubmitting(false);
    if (result.success) {
      setCancelTarget(null);
      toast.success("Factura cancelada");
      router.refresh();
    } else toast.error(result.error);
  };

  const columns: DataTableColumn<SupplierBillListItem>[] = [
    {
      key: "folio",
      header: "Factura",
      cell: (b) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate">{b.folio}</div>
          {b.purchaseOrderFolio && (
            <div className="text-xs text-muted-foreground truncate">OC {b.purchaseOrderFolio}</div>
          )}
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Proveedor",
      cell: (b) => <span className="text-sm truncate block">{b.supplierName}</span>,
    },
    {
      key: "issueDate",
      header: "Emision",
      cell: (b) => (
        <span className="font-mono tabular-nums text-xs text-muted-foreground">
          {new Date(b.issueDate).toLocaleDateString("es-MX")}
        </span>
      ),
    },
    {
      key: "dueDate",
      header: "Vencimiento",
      cell: (b) => (
        <span className="font-mono tabular-nums text-xs text-muted-foreground">
          {b.dueDate ? new Date(b.dueDate).toLocaleDateString("es-MX") : "—"}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (b) => <span className="font-mono tabular-nums text-sm">${money(b.total)}</span>,
    },
    {
      key: "balance",
      header: "Saldo",
      align: "right",
      cell: (b) => (
        <span className="font-mono tabular-nums font-semibold text-[var(--ops-warning)]">
          ${money(b.balance)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (b) => statusToPill(b.status, b.isOverdue),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-32",
      cell: (b) => (
        <div className="flex items-center justify-end gap-1">
          {b.status !== "paid" && b.status !== "cancelled" && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-[var(--ops-success)]"
              onClick={(ev) => {
                ev.stopPropagation();
                setPayTarget(b);
              }}
              aria-label="Registrar pago"
            >
              <HandCoins className="h-4 w-4" />
            </Button>
          )}
          {b.status === "open" && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={(ev) => {
                ev.stopPropagation();
                setCancelTarget(b);
              }}
              aria-label="Cancelar factura"
            >
              <Ban className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cuentas por pagar"
        description="Facturas de proveedor, saldos pendientes y pagos registrados."
        badge={`${bills.length} facturas`}
        actions={
          <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsFromPoOpen(true)}>
              <FileSpreadsheet className="h-4 w-4" />
              Generar desde OC
            </Button>
            <Button variant="brand" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva factura
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total adeudado" value={`$${money(summary.totalOwed)}`} icon={Wallet} accent="brand" size="compact" />
        <KpiCard label="Vencido" value={`$${money(summary.totalOverdue)}`} icon={AlertTriangle} accent="danger" size="compact" />
        <KpiCard label="Pagado este mes" value={`$${money(summary.totalPaidThisMonth)}`} icon={HandCoins} accent="success" size="compact" />
        <KpiCard label="Facturas abiertas" value={summary.openCount} icon={FileStack} accent="warning" size="compact" />
      </div>

      <ResponsiveListView<SupplierBillListItem>
        columns={columns}
        rows={filtered}
        rowKey={(b) => b.billId}
        density="compact"
        mobileCard={(b) => (
          <MobileListCard
            key={b.billId}
            title={b.folio}
            subtitle={
              <>
                {b.supplierName}
                {b.purchaseOrderFolio && ` · OC ${b.purchaseOrderFolio}`}
              </>
            }
            value={
              <span className="font-mono tabular-nums font-semibold text-[var(--ops-warning)]">
                ${money(b.balance)}
              </span>
            }
            actions={
              <div className="flex items-center gap-0.5">
                {b.status !== "paid" && b.status !== "cancelled" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground hover:text-[var(--ops-success)]"
                    onClick={() => setPayTarget(b)}
                    aria-label="Registrar pago"
                  >
                    <HandCoins className="h-4 w-4" />
                  </Button>
                )}
                {b.status === "open" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground hover:text-destructive"
                    onClick={() => setCancelTarget(b)}
                    aria-label="Cancelar factura"
                  >
                    <Ban className="h-4 w-4" />
                  </Button>
                )}
              </div>
            }
            meta={
              <>
                {statusToPill(b.status, b.isOverdue)}
                <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                  Total ${money(b.total)}
                </span>
                {b.dueDate && (
                  <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                    Vence {new Date(b.dueDate).toLocaleDateString("es-MX")}
                  </span>
                )}
              </>
            }
          />
        )}
        toolbar={
          <div className="flex flex-col gap-3 w-full">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <InputGroup className="flex-1 min-w-[180px] max-w-md">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="Buscar folio, proveedor u OC…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <Badge variant="brand">{filtered.length}</Badge>
                </InputGroupAddon>
              </InputGroup>
              <div className="md:hidden">
                <MobileFilterSheet
                  activeCount={activeFilters}
                  onClear={() => {
                    setStatusFilter(ALL);
                    setSupplierFilter(ALL);
                  }}
                >
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Estado</label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-10 w-full text-sm">
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>Todos los estados</SelectItem>
                          <SelectItem value="open">Abierta</SelectItem>
                          <SelectItem value="partial">Parcial</SelectItem>
                          <SelectItem value="paid">Pagada</SelectItem>
                          <SelectItem value="cancelled">Cancelada</SelectItem>
                          <SelectItem value="overdue">Vencida</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Proveedor</label>
                      <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                        <SelectTrigger className="h-10 w-full text-sm">
                          <SelectValue placeholder="Proveedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>Todos los proveedores</SelectItem>
                          {suppliers.map((s) => (
                            <SelectItem key={s.supplierId} value={String(s.supplierId)}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </MobileFilterSheet>
              </div>
            </div>
            <div className="hidden md:flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ListFilter className="h-3.5 w-3.5" />
                Filtros
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los estados</SelectItem>
                  <SelectItem value="open">Abierta</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="paid">Pagada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                  <SelectItem value="overdue">Vencida</SelectItem>
                </SelectContent>
              </Select>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[160px] text-xs">
                  <SelectValue placeholder="Proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los proveedores</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.supplierId} value={String(s.supplierId)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeFilters > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setStatusFilter(ALL);
                    setSupplierFilter(ALL);
                  }}
                >
                  Limpiar ({activeFilters})
                </Button>
              )}
            </div>
          </div>
        }
        emptyState={
          <EmptyState
            title="No hay facturas"
            description={
              search || activeFilters > 0
                ? "No se encontraron resultados con los filtros aplicados."
                : "Registra una factura o genera una desde una OC recibida."
            }
          />
        }
      />

      {/* Crear factura manual */}
      <ResponsiveFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        a11yTitle="Nueva factura de proveedor"
        description="Registra una factura de proveedor manual."
        desktopMaxWidth="sm:max-w-xl"
      >
        <FormDialogHeader
          icon={Receipt}
          title="Nueva factura"
          description="Registra una factura de proveedor manual."
        />
        <form onSubmit={handleCreate} className="space-y-5 mt-4">
          <Field label="Proveedor" icon={Building2} required>
            <Select name="supplierId">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.supplierId} value={String(s.supplierId)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fecha de emision" icon={CalendarDays} required>
              <Input
                name="issueDate"
                type="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
              />
            </Field>
            <Field label="Fecha de vencimiento" icon={CalendarDays}>
              <Input name="dueDate" type="date" />
            </Field>
          </div>
          <Field label="Total" icon={Hash} required>
            <Input name="total" type="number" step="0.01" min="0.01" required placeholder="0.00" />
          </Field>
          <Field label="Notas">
            <Textarea name="notes" placeholder="Observaciones de la factura…" />
          </Field>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Creando…" : "Crear factura"}
            </Button>
          </div>
        </form>
      </ResponsiveFormDialog>

      {/* Generar desde OC recibida */}
      <ResponsiveFormDialog
        open={isFromPoOpen}
        onOpenChange={setIsFromPoOpen}
        a11yTitle="Generar factura desde OC recibida"
        description="Toma el total de una orden de compra ya recibida."
        desktopMaxWidth="sm:max-w-xl"
      >
        <FormDialogHeader
          icon={FileSpreadsheet}
          title="Generar factura desde OC"
          description="Toma el total de una orden de compra ya recibida."
        />
        <form onSubmit={handleCreateFromPo} className="space-y-5 mt-4">
          <Field label="Orden de compra" icon={FileStack} required>
            <Select name="poId">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar OC recibida..." />
              </SelectTrigger>
              <SelectContent>
                {receivablePOs.map((po) => (
                  <SelectItem key={po.poId} value={String(po.poId)}>
                    {po.folio} · {po.supplierName} · ${money(po.total)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {receivablePOs.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No hay OCs recibidas pendientes de facturar.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fecha de emision" icon={CalendarDays} required>
              <Input
                name="issueDate"
                type="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
              />
            </Field>
            <Field label="Fecha de vencimiento" icon={CalendarDays}>
              <Input name="dueDate" type="date" />
            </Field>
          </div>
          <Field label="Notas">
            <Textarea name="notes" placeholder="Observaciones de la factura…" />
          </Field>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsFromPoOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={isSubmitting || receivablePOs.length === 0}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Generando…" : "Generar factura"}
            </Button>
          </div>
        </form>
      </ResponsiveFormDialog>

      {/* Registrar pago */}
      <ResponsiveFormDialog
        open={!!payTarget}
        onOpenChange={(open) => !open && setPayTarget(null)}
        a11yTitle="Registrar pago"
        description="Registra un pago a proveedor contra esta factura."
        desktopMaxWidth="sm:max-w-lg"
      >
        {payTarget && (
          <>
            <FormDialogHeader
              icon={HandCoins}
              title={`Pago · ${payTarget.folio}`}
              description={`${payTarget.supplierName} — saldo pendiente $${money(payTarget.balance)}`}
            />
            <form onSubmit={handlePay} className="space-y-5 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Monto" icon={Hash} required>
                  <Input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={payTarget.balance}
                    required
                    defaultValue={payTarget.balance.toFixed(2)}
                  />
                </Field>
                <Field label="Fecha de pago" icon={CalendarDays} required>
                  <Input
                    name="paymentDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                  />
                </Field>
              </div>
              <Field label="Metodo de pago" icon={CreditCard} required>
                <Select name="method" defaultValue="transfer">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Notas">
                <Textarea name="notes" placeholder="Referencia, numero de transferencia…" />
              </Field>
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setPayTarget(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="brand" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Registrando…" : "Registrar pago"}
                </Button>
              </div>
            </form>
          </>
        )}
      </ResponsiveFormDialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar factura {cancelTarget?.folio}?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se puede cancelar una factura sin pagos registrados. Esta accion requiere
              permisos de administrador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              Cancelar factura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Fab icon={Plus} label="Nueva factura" onClick={() => setIsCreateOpen(true)} />
    </div>
  );
}
