"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { type DataTableColumn } from "@/components/ui/data-table";
import { MetricTile } from "@/components/ui/metric-tile";
import { StatusPill, type OpsStatus } from "@/components/ui/status-pill";
import {
  Plus,
  Search,
  CircleCheck,
  X,
  SquarePen,
  Trash2,
  MoreHorizontal,
  BookmarkCheck,
  UserRound,
  PhoneCall,
  AtSign,
  CalendarDays,
  FolderTree,
  Hash,
  CircleDollarSign,
  CreditCard,
  Loader2,
  ListFilter,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  createReservation,
  updateReservation,
  deleteReservation,
  deleteReservations,
  cancelReservation,
  completeReservation,
} from "../actions/paca-reservation-actions";
import { PacaClientPicker, type PacaClientOption } from "./paca-client-picker";
import { RESERVATION_STATUSES, PAYMENT_METHODS } from "@/lib/constants";

interface ReservationItem {
  reservationId: number;
  categoryId: number;
  clientId: number | null;
  quantity: number;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  reservationDate: string;
  expirationDate: string | null;
  notes: string | null;
  status: string;
  category: { name: string; classification: { name: string } | null };
}

interface CategoryOption {
  categoryId: number;
  name: string;
  available: number;
}

const ALL = "__all__";

const STATUS_TO_OPS: Record<string, OpsStatus> = {
  active: "active",
  completed: "completed",
  cancelled: "cancelled",
};

export function ReservationListClient({
  reservations,
  availableCategories,
  pacaClients,
}: {
  reservations: ReservationItem[];
  availableCategories: CategoryOption[];
  pacaClients: PacaClientOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<ReservationItem | null>(null);
  const [toCancel, setToCancel] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [toComplete, setToComplete] = useState<ReservationItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createClient, setCreateClient] = useState<PacaClientOption | null>(null);
  const [editClient, setEditClient] = useState<PacaClientOption | null>(null);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());

  const editClientInitial = useMemo<PacaClientOption | null>(() => {
    if (!toEdit) return null;
    if (toEdit.clientId != null) {
      return (
        pacaClients.find((c) => c.clientId === toEdit.clientId) ?? {
          clientId: toEdit.clientId,
          name: toEdit.clientName,
          phone: toEdit.clientPhone,
          email: toEdit.clientEmail,
        }
      );
    }
    return null;
  }, [toEdit, pacaClients]);

  useEffect(() => {
    setEditClient(editClientInitial);
  }, [editClientInitial]);

  const today = new Date().toISOString().split("T")[0];
  const counts = useMemo(() => {
    const c = { active: 0, completed: 0, cancelled: 0, expiringSoon: 0 };
    for (const r of reservations) {
      c[r.status as keyof typeof c]++;
      if (
        r.status === "active" &&
        r.expirationDate &&
        r.expirationDate >= today &&
        new Date(r.expirationDate).getTime() - Date.now() < 14 * 24 * 60 * 60 * 1000
      ) {
        c.expiringSoon++;
      }
    }
    return c;
  }, [reservations, today]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return reservations.filter((r) => {
      if (statusFilter !== ALL && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.clientName.toLowerCase().includes(q) ||
        r.category.name.toLowerCase().includes(q) ||
        (r.clientPhone?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [reservations, search, statusFilter]);

  const getStatusLabel = (status: string) =>
    RESERVATION_STATUSES.find((s) => s.value === status)?.label ?? status;

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!createClient) {
      toast.error("Selecciona o crea un cliente");
      return;
    }
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const result = await createReservation({
      categoryId: Number(fd.get("categoryId")),
      quantity: Number(fd.get("quantity")),
      clientId: createClient.clientId,
      clientName: createClient.name,
      clientPhone: createClient.phone ?? undefined,
      clientEmail: createClient.email ?? undefined,
      reservationDate: fd.get("reservationDate") as string,
      expirationDate: (fd.get("expirationDate") as string) || undefined,
      notes: (fd.get("notes") as string) || undefined,
    });
    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      setCreateClient(null);
      toast.success("Reservación creada");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!toEdit) return;
    e.preventDefault();
    if (!editClient) {
      toast.error("Selecciona o crea un cliente");
      return;
    }
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const result = await updateReservation(toEdit.reservationId, {
      clientId: editClient.clientId,
      clientName: editClient.name,
      clientPhone: editClient.phone ?? undefined,
      clientEmail: editClient.email ?? undefined,
      reservationDate: fd.get("reservationDate") as string,
      expirationDate: (fd.get("expirationDate") as string) || undefined,
      notes: (fd.get("notes") as string) || undefined,
      quantity: Number(fd.get("quantity")),
    });
    setIsSubmitting(false);
    if (result.success) {
      setToEdit(null);
      setEditClient(null);
      toast.success("Reservación actualizada");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleComplete = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!toComplete) return;
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const result = await completeReservation(toComplete.reservationId, {
      salePrice: Number(fd.get("salePrice")),
      paymentMethod: (fd.get("paymentMethod") as string) || undefined,
      saleDate: fd.get("saleDate") as string,
      notes: (fd.get("notes") as string) || undefined,
    });
    setIsSubmitting(false);
    if (result.success) {
      setToComplete(null);
      toast.success("Reservación completada y venta registrada");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleCancel = async () => {
    if (!toCancel) return;
    setIsSubmitting(true);
    const result = await cancelReservation(toCancel);
    setIsSubmitting(false);
    if (result.success) {
      setToCancel(null);
      toast.success("Reservación cancelada");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsSubmitting(true);
    const result = await deleteReservation(toDelete);
    setIsSubmitting(false);
    if (result.success) {
      setToDelete(null);
      toast.success("Reservación eliminada");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setIsSubmitting(true);
    const ids = Array.from(selected).map((k) => Number(k));
    const r = await deleteReservations(ids);
    setIsSubmitting(false);
    if (r.success) {
      toast.success(`${r.data.deleted} reservación(es) eliminada(s)`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      router.refresh();
    } else toast.error(r.error);
  };

  const columns: DataTableColumn<ReservationItem>[] = [
    {
      key: "client",
      header: "Cliente",
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate">{r.clientName}</div>
          {r.clientPhone && (
            <div className="text-xs text-muted-foreground truncate">{r.clientPhone}</div>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: "Categoría",
      cell: (r) => (
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground truncate block">
            {r.category.name}
          </span>
          {r.category.classification && (
            <Badge variant="outline" className="text-[10px] mt-0.5">
              {r.category.classification.name}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "qty",
      header: "Cant.",
      align: "right",
      cell: (r) => (
        <Badge variant="info" className="font-mono tabular-nums">
          {r.quantity}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (r) => <StatusPill status={STATUS_TO_OPS[r.status] ?? "idle"} size="sm" />,
    },
    {
      key: "dates",
      header: "Fechas",
      cell: (r) => (
        <div className="text-xs">
          <div className="font-mono tabular-nums text-foreground">{r.reservationDate}</div>
          {r.expirationDate && (
            <div className="font-mono tabular-nums text-muted-foreground">
              → {r.expirationDate}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-28",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          {r.status === "active" && (
            <Button
              size="sm"
              variant="brand"
              onClick={(e) => {
                e.stopPropagation();
                setToComplete(r);
              }}
              title="Completar"
              className="h-8"
            >
              <CircleCheck className="h-3.5 w-3.5" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {r.status === "active" && (
                <>
                  <DropdownMenuItem onClick={() => setToEdit(r)}>
                    <SquarePen className="h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setToCancel(r.reservationId)}
                    className="text-[var(--ops-warning)] focus:text-[var(--ops-warning)]"
                  >
                    <X className="h-4 w-4" /> Cancelar
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem
                onClick={() => setToDelete(r.reservationId)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={BookmarkCheck}
        title="Reservaciones"
        description="Gestiona reservaciones de pacas por cliente y completa ventas cuando se cierran."
        badge={`${reservations.length} reservaciones`}
        actions={
          <Button
            variant="brand"
            onClick={() => setIsCreateOpen(true)}
            className="hidden md:inline-flex"
          >
            <Plus className="h-4 w-4" />
            Nueva reservación
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricTile
          label="Activas"
          value={counts.active}
          icon={BookmarkCheck}
          tone="active"
          active={statusFilter === "active"}
          onClick={() => setStatusFilter(statusFilter === "active" ? ALL : "active")}
        />
        <MetricTile
          label="Completadas"
          value={counts.completed}
          icon={TrendingUp}
          tone="success"
          active={statusFilter === "completed"}
          onClick={() => setStatusFilter(statusFilter === "completed" ? ALL : "completed")}
        />
        <MetricTile
          label="Canceladas"
          value={counts.cancelled}
          icon={X}
          tone="critical"
          active={statusFilter === "cancelled"}
          onClick={() => setStatusFilter(statusFilter === "cancelled" ? ALL : "cancelled")}
        />
        <MetricTile
          label="Por vencer (14d)"
          value={counts.expiringSoon}
          icon={AlertTriangle}
          tone={counts.expiringSoon > 0 ? "warning" : "idle"}
        />
      </div>

      <ResponsiveListView<ReservationItem>
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.reservationId}
        density="compact"
        selectedKeys={selected}
        onSelectionChange={setSelected}
        mobileCard={(r) => (
          <MobileListCard
            key={r.reservationId}
            title={r.clientName}
            subtitle={
              <>
                {r.category.name} · {r.quantity} pacas
                {r.clientPhone && ` · ${r.clientPhone}`}
              </>
            }
            value={<StatusPill status={STATUS_TO_OPS[r.status] ?? "idle"} size="sm" />}
            actions={
              <div className="flex items-center gap-1">
                {r.status === "active" && (
                  <Button
                    size="icon"
                    variant="brand"
                    onClick={() => setToComplete(r)}
                    className="size-9"
                    aria-label="Completar reservación"
                  >
                    <CircleCheck className="h-4 w-4" />
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-9">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {r.status === "active" && (
                      <>
                        <DropdownMenuItem onClick={() => setToEdit(r)}>
                          <SquarePen className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setToCancel(r.reservationId)}
                          className="text-[var(--ops-warning)] focus:text-[var(--ops-warning)]"
                        >
                          <X className="h-4 w-4" /> Cancelar
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem
                      onClick={() => setToDelete(r.reservationId)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
            meta={
              <>
                <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                  {r.reservationDate}
                </span>
                {r.expirationDate && (
                  <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                    → {r.expirationDate}
                  </span>
                )}
                {r.category.classification && (
                  <Badge variant="outline" className="text-[10px]">
                    {r.category.classification.name}
                  </Badge>
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
                  placeholder="Buscar cliente, categoría o teléfono…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <Badge variant="brand">{filtered.length}</Badge>
                </InputGroupAddon>
              </InputGroup>
              <div className="md:hidden">
                <MobileFilterSheet
                  activeCount={statusFilter !== ALL ? 1 : 0}
                  onClear={() => setStatusFilter(ALL)}
                >
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Estado
                    </label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-10 w-full text-sm">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>Todos</SelectItem>
                        {RESERVATION_STATUSES.filter((s) => s.value !== "expired").map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {getStatusLabel(s.value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </MobileFilterSheet>
              </div>
              {selected.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs text-destructive hover:text-destructive"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar {selected.size}
                </Button>
              )}
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
                  {RESERVATION_STATUSES.filter((s) => s.value !== "expired").map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {getStatusLabel(s.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {statusFilter !== ALL && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setStatusFilter(ALL)}
                >
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        }
        emptyState={
          <EmptyState
            title="No hay reservaciones"
            description={
              search || statusFilter !== ALL
                ? "No se encontraron resultados con los filtros aplicados."
                : "Crea la primera reservación para empezar."
            }
          />
        }
      />

      {/* Crear */}
      <ResponsiveFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        a11yTitle="Nueva reservación"
        description="Reserva pacas para un cliente indicando cantidad y fecha."
        desktopMaxWidth="sm:max-w-xl"
      >
        <FormDialogHeader
          icon={BookmarkCheck}
          title="Nueva reservación"
          description="Reserva pacas para un cliente indicando cantidad y fecha."
        />
        <form onSubmit={handleCreate} className="space-y-5 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Categoría" icon={FolderTree} required>
                <Select name="categoryId">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((c) => (
                      <SelectItem key={c.categoryId} value={String(c.categoryId)}>
                        {c.name} ({c.available} disp.)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cantidad" icon={Hash} required>
                <Input name="quantity" type="number" min="1" required />
              </Field>
            </div>
            <Field label="Cliente" icon={UserRound} required>
              <PacaClientPicker
                clients={pacaClients}
                value={createClient?.clientId ?? null}
                onChange={setCreateClient}
              />
            </Field>
            {createClient && (createClient.phone || createClient.email) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground px-1">
                {createClient.phone && (
                  <span className="inline-flex items-center gap-1">
                    <PhoneCall className="h-3 w-3" /> {createClient.phone}
                  </span>
                )}
                {createClient.email && (
                  <span className="inline-flex items-center gap-1">
                    <AtSign className="h-3 w-3" /> {createClient.email}
                  </span>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Fecha reservación" icon={CalendarDays} required>
                <Input name="reservationDate" type="date" required />
              </Field>
              <Field label="Fecha expiración" icon={CalendarDays}>
                <Input name="expirationDate" type="date" />
              </Field>
            </div>
            <Field label="Notas">
              <Textarea name="notes" />
            </Field>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setCreateClient(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Creando…" : "Crear reservación"}
              </Button>
            </div>
          </form>
        </ResponsiveFormDialog>

      {/* Editar */}
      <ResponsiveFormDialog
        open={!!toEdit}
        onOpenChange={(o) => !o && setToEdit(null)}
        a11yTitle="Editar reservación"
        description={toEdit?.clientName ?? undefined}
        desktopMaxWidth="sm:max-w-xl"
      >
        <FormDialogHeader
          icon={SquarePen}
          title="Editar reservación"
          description={toEdit?.clientName}
        />
        <form onSubmit={handleUpdate} className="space-y-5 mt-4">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <FolderTree className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Categoría:</span> {toEdit?.category.name}
            </div>
            <Field label="Cantidad" icon={Hash} required>
              <Input
                name="quantity"
                type="number"
                min="1"
                defaultValue={toEdit?.quantity}
                required
              />
            </Field>
            <Field label="Cliente" icon={UserRound} required>
              <PacaClientPicker
                clients={pacaClients}
                value={editClient?.clientId ?? null}
                onChange={setEditClient}
              />
            </Field>
            {editClient && (editClient.phone || editClient.email) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground px-1">
                {editClient.phone && (
                  <span className="inline-flex items-center gap-1">
                    <PhoneCall className="h-3 w-3" /> {editClient.phone}
                  </span>
                )}
                {editClient.email && (
                  <span className="inline-flex items-center gap-1">
                    <AtSign className="h-3 w-3" /> {editClient.email}
                  </span>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Fecha reservación" icon={CalendarDays} required>
                <Input
                  name="reservationDate"
                  type="date"
                  defaultValue={toEdit?.reservationDate}
                  required
                />
              </Field>
              <Field label="Fecha expiración" icon={CalendarDays}>
                <Input
                  name="expirationDate"
                  type="date"
                  defaultValue={toEdit?.expirationDate ?? ""}
                />
              </Field>
            </div>
            <Field label="Notas">
              <Textarea name="notes" defaultValue={toEdit?.notes ?? ""} />
            </Field>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setToEdit(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Actualizando…" : "Actualizar"}
              </Button>
            </div>
          </form>
        </ResponsiveFormDialog>

      {/* Completar */}
      <ResponsiveFormDialog
        open={!!toComplete}
        onOpenChange={(o) => !o && setToComplete(null)}
        a11yTitle="Completar reservación"
        description="Registra la venta con precio y método de pago."
        desktopMaxWidth="sm:max-w-xl"
      >
        <FormDialogHeader
          icon={CircleCheck}
          title="Completar reservación"
          description="Registra la venta con precio y método de pago."
        />
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm space-y-1.5 mt-4 mb-2">
            <p className="flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Cliente:</span> {toComplete?.clientName}
            </p>
            <p className="flex items-center gap-1.5">
              <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Categoría:</span> {toComplete?.category.name}
            </p>
            <p className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Cantidad:</span> {toComplete?.quantity} pacas
            </p>
          </div>
          <form onSubmit={handleComplete} className="space-y-5">
            <FormSection
              icon={CircleDollarSign}
              title="Datos de venta"
              description="Precio por unidad y fecha."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Precio por unidad" icon={CircleDollarSign} required>
                  <Input name="salePrice" type="number" step="0.01" required placeholder="Ej. 35.00" />
                </Field>
                <Field label="Fecha de venta" icon={CalendarDays} required>
                  <Input
                    name="saleDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                  />
                </Field>
              </div>
              <Field label="Método de pago" icon={CreditCard}>
                <Select name="paymentMethod">
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
                <Textarea name="notes" placeholder="Observaciones de la venta…" />
              </Field>
            </FormSection>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setToComplete(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Completando…" : "Registrar venta"}
              </Button>
            </div>
          </form>
        </ResponsiveFormDialog>

      {/* Cancelar */}
      <AlertDialog open={!!toCancel} onOpenChange={() => setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar reservación?</AlertDialogTitle>
            <AlertDialogDescription>
              Las pacas volverán a estar disponibles. La reservación quedará marcada como cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-[var(--ops-warning)] text-white hover:opacity-90"
              disabled={isSubmitting}
            >
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Eliminar single */}
      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar reservación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente este registro. Si estaba activa, las pacas volverán a estar disponibles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Eliminar bulk */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selected.size} reservación(es)?</AlertDialogTitle>
            <AlertDialogDescription>
              Las pacas asociadas a reservaciones activas volverán a estar disponibles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Eliminando…" : "Eliminar todas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Fab icon={Plus} label="Nueva reservación" onClick={() => setIsCreateOpen(true)} />
    </div>
  );
}
