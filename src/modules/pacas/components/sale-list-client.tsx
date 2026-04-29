"use client";

import { useMemo, useState } from "react";
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
import { MetricTile } from "@/components/ui/metric-tile";
import {
  Plus,
  Search,
  Trash2,
  CircleDollarSign,
  ShoppingBag,
  UserRound,
  PhoneCall,
  CalendarDays,
  FolderTree,
  Hash,
  CreditCard,
  TrendingUp,
  ListFilter,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { createSale, deleteSale, deleteSales } from "../actions/paca-sale-actions";
import { PAYMENT_METHODS } from "@/lib/constants";

interface SaleItem {
  saleId: number;
  categoryId: number;
  quantity: number;
  salePrice: number;
  clientName: string;
  clientPhone: string | null;
  paymentMethod: string | null;
  saleDate: string;
  notes: string | null;
  category: { name: string; classification: { name: string } | null };
}

interface CategoryOption {
  categoryId: number;
  name: string;
  available: number;
}

interface Props {
  sales: SaleItem[];
  availableCategories: CategoryOption[];
  stats: { totalSales: number; totalRevenue: number };
}

const ALL = "__all__";

export function SaleListClient({ sales, availableCategories, stats }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sales.filter((s) => {
      if (methodFilter !== ALL && (s.paymentMethod ?? "") !== methodFilter) return false;
      if (dateFrom && s.saleDate < dateFrom) return false;
      if (dateTo && s.saleDate > dateTo) return false;
      if (!q) return true;
      return (
        s.clientName.toLowerCase().includes(q) ||
        s.category.name.toLowerCase().includes(q) ||
        (s.clientPhone?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [sales, search, methodFilter, dateFrom, dateTo]);

  const filteredRevenue = useMemo(
    () =>
      filtered.reduce(
        (acc, s) => acc + s.quantity * Number(s.salePrice),
        0
      ),
    [filtered]
  );
  const filteredUnits = useMemo(
    () => filtered.reduce((acc, s) => acc + s.quantity, 0),
    [filtered]
  );

  const getPaymentLabel = (method: string | null) =>
    PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method ?? "—";

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const result = await createSale({
      categoryId: Number(fd.get("categoryId")),
      quantity: Number(fd.get("quantity")),
      salePrice: Number(fd.get("salePrice")),
      clientName: fd.get("clientName") as string,
      clientPhone: (fd.get("clientPhone") as string) || undefined,
      paymentMethod: (fd.get("paymentMethod") as string) || undefined,
      saleDate: fd.get("saleDate") as string,
      notes: (fd.get("notes") as string) || undefined,
    });
    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      toast.success("Venta registrada");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsSubmitting(true);
    const result = await deleteSale(toDelete);
    setIsSubmitting(false);
    if (result.success) {
      setToDelete(null);
      toast.success("Venta eliminada");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setIsSubmitting(true);
    const ids = Array.from(selected).map((k) => Number(k));
    const r = await deleteSales(ids);
    setIsSubmitting(false);
    if (r.success) {
      toast.success(`${r.data.deleted} venta(s) eliminada(s)`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      router.refresh();
    } else toast.error(r.error);
  };

  const activeFilters =
    (methodFilter !== ALL ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const columns: DataTableColumn<SaleItem>[] = [
    {
      key: "client",
      header: "Cliente",
      cell: (s) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate">{s.clientName}</div>
          {s.clientPhone && (
            <div className="text-xs text-muted-foreground truncate">{s.clientPhone}</div>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: "Categoría",
      cell: (s) => (
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground truncate block">
            {s.category.name}
          </span>
          {s.category.classification && (
            <Badge variant="outline" className="text-[10px] mt-0.5">
              {s.category.classification.name}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "qty",
      header: "Cant.",
      align: "right",
      cell: (s) => (
        <Badge variant="info" className="font-mono tabular-nums">
          {s.quantity}
        </Badge>
      ),
    },
    {
      key: "price",
      header: "Precio/U",
      align: "right",
      cell: (s) => (
        <span className="font-mono tabular-nums text-sm">${s.salePrice.toFixed(2)}</span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (s) => {
        const total = s.quantity * Number(s.salePrice);
        return (
          <span className="font-mono tabular-nums font-semibold text-[var(--ops-success)]">
            ${total.toFixed(2)}
          </span>
        );
      },
    },
    {
      key: "method",
      header: "Pago",
      cell: (s) => (
        <Badge variant="secondary" className="text-xs">
          {getPaymentLabel(s.paymentMethod)}
        </Badge>
      ),
    },
    {
      key: "date",
      header: "Fecha",
      cell: (s) => (
        <span className="font-mono tabular-nums text-xs text-muted-foreground">
          {s.saleDate}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-12",
      cell: (s) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          onClick={(ev) => {
            ev.stopPropagation();
            setToDelete(s.saleId);
          }}
          aria-label="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ShoppingBag}
        title="Ventas de pacas"
        description="Historial de ventas con cliente, categoría y método de pago."
        badge={`${sales.length} ventas`}
        actions={
          <Button
            variant="brand"
            onClick={() => setIsCreateOpen(true)}
            className="hidden md:inline-flex"
          >
            <Plus className="h-4 w-4" />
            Registrar venta
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricTile
          label="Pacas vendidas (total)"
          value={stats.totalSales}
          icon={ShoppingBag}
          tone="active"
        />
        <MetricTile
          label="Ingresos (total)"
          value={`$${stats.totalRevenue.toFixed(0)}`}
          icon={TrendingUp}
          tone="success"
        />
        <MetricTile
          label="Pacas (filtro)"
          value={filteredUnits}
          icon={Hash}
          tone="track"
        />
        <MetricTile
          label="Ingresos (filtro)"
          value={`$${filteredRevenue.toFixed(0)}`}
          icon={CircleDollarSign}
          tone="warning"
        />
      </div>

      <ResponsiveListView<SaleItem>
        columns={columns}
        rows={filtered}
        rowKey={(s) => s.saleId}
        density="compact"
        selectedKeys={selected}
        onSelectionChange={setSelected}
        mobileCard={(s) => {
          const total = s.quantity * Number(s.salePrice);
          return (
            <MobileListCard
              key={s.saleId}
              title={s.clientName}
              subtitle={
                <>
                  {s.category.name} · {s.quantity} pacas
                  {s.clientPhone && ` · ${s.clientPhone}`}
                </>
              }
              value={
                <span className="font-mono tabular-nums font-semibold text-[var(--ops-success)]">
                  ${total.toFixed(2)}
                </span>
              }
              actions={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-muted-foreground hover:text-destructive"
                  onClick={() => setToDelete(s.saleId)}
                  aria-label="Eliminar venta"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
              meta={
                <>
                  <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                    {s.saleDate}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {getPaymentLabel(s.paymentMethod)}
                  </Badge>
                  <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                    ${s.salePrice.toFixed(2)}/u
                  </span>
                </>
              }
            />
          );
        }}
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
                  activeCount={activeFilters}
                  onClear={() => {
                    setMethodFilter(ALL);
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Método de pago
                      </label>
                      <Select value={methodFilter} onValueChange={setMethodFilter}>
                        <SelectTrigger className="h-10 w-full text-sm">
                          <SelectValue placeholder="Pago" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>Todos los métodos</SelectItem>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">Desde</label>
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">Hasta</label>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="h-10"
                        />
                      </div>
                    </div>
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
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs">
                  <SelectValue placeholder="Pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los métodos</SelectItem>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">Desde</span>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 w-36"
                />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">Hasta</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 w-36"
                />
              </div>
              {activeFilters > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setMethodFilter(ALL);
                    setDateFrom("");
                    setDateTo("");
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
            title="No hay ventas"
            description={
              search || activeFilters > 0
                ? "No se encontraron resultados con los filtros aplicados."
                : "Registra la primera venta para empezar."
            }
          />
        }
      />

      <ResponsiveFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        a11yTitle="Registrar venta"
        description="Crea una venta directa de pacas."
        desktopMaxWidth="sm:max-w-xl"
      >
        <FormDialogHeader
          icon={ShoppingBag}
          title="Registrar venta"
          description="Crea una venta directa de pacas."
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
              <Input name="clientName" required placeholder="Nombre del cliente" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Teléfono" icon={PhoneCall}>
                <Input name="clientPhone" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Precio por unidad" icon={CircleDollarSign} required>
                <Input name="salePrice" type="number" step="0.01" required placeholder="0.00" />
              </Field>
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
            </div>
            <Field label="Notas">
              <Textarea name="notes" placeholder="Observaciones de la venta…" />
            </Field>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Registrando…" : "Registrar venta"}
              </Button>
            </div>
          </form>
        </ResponsiveFormDialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Las pacas volverán a estar disponibles.
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

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selected.size} venta(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Las pacas correspondientes volverán a estar disponibles.
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

      <Fab icon={Plus} label="Registrar venta" onClick={() => setIsCreateOpen(true)} />
    </div>
  );
}
