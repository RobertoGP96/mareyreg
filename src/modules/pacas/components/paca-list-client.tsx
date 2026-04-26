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
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MetricTile } from "@/components/ui/metric-tile";
import {
  Plus,
  Trash2,
  Package2,
  CircleCheck,
  Bookmark,
  HandCoins,
  CircleDollarSign,
  Search,
  ListFilter,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  createPacaEntry,
  deletePacaEntry,
  deletePacaEntries,
} from "../actions/paca-actions";
import { PacaEntryForm } from "./paca-form";

interface InventoryItem {
  categoryId: number;
  available: number;
  reserved: number;
  sold: number;
  totalCost: number;
  category: {
    name: string;
    classification: { name: string } | null;
  };
}

interface EntryItem {
  entryId: number;
  quantity: number;
  purchasePrice: number | null;
  supplier: string | null;
  origin: string | null;
  arrivalDate: string | null;
  createdAt: Date;
  category: { name: string };
}

interface CategoryItem {
  categoryId: number;
  name: string;
  classification: { classificationId: number; name: string } | null;
}

interface Props {
  inventory: InventoryItem[];
  entries: EntryItem[];
  categories: CategoryItem[];
}

const ALL = "__all__";

export function PacaListClient({ inventory, entries, categories }: Props) {
  const router = useRouter();
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>(ALL);
  const [stockFilter, setStockFilter] = useState<string>(ALL); // "low" | "empty" | ALL
  const [selectedEntries, setSelectedEntries] = useState<Set<string | number>>(new Set());

  const classifications = useMemo(() => {
    const set = new Set<string>();
    for (const i of inventory) {
      if (i.category.classification?.name) set.add(i.category.classification.name);
    }
    return Array.from(set).sort();
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    const q = search.toLowerCase().trim();
    return inventory.filter((i) => {
      if (
        classFilter !== ALL &&
        (i.category.classification?.name ?? "") !== classFilter
      )
        return false;
      if (stockFilter === "low" && i.available > 5) return false;
      if (stockFilter === "empty" && i.available > 0) return false;
      if (!q) return true;
      return (
        i.category.name.toLowerCase().includes(q) ||
        (i.category.classification?.name?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [inventory, search, classFilter, stockFilter]);

  const totalAvailable = inventory.reduce((s, i) => s + i.available, 0);
  const totalReserved = inventory.reduce((s, i) => s + i.reserved, 0);
  const totalSold = inventory.reduce((s, i) => s + i.sold, 0);
  const totalValue = inventory.reduce((s, i) => s + Number(i.totalCost), 0);
  const lowStock = inventory.filter((i) => i.available > 0 && i.available <= 5).length;

  const handleCreateEntry = async (data: Parameters<typeof createPacaEntry>[0]) => {
    setIsSubmitting(true);
    const result = await createPacaEntry(data);
    setIsSubmitting(false);
    if (result.success) {
      setIsEntryOpen(false);
      toast.success("Entrada registrada exitosamente");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;
    setIsSubmitting(true);
    const result = await deletePacaEntry(entryToDelete);
    setIsSubmitting(false);
    if (result.success) {
      setEntryToDelete(null);
      toast.success("Entrada eliminada");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleBulkDelete = async () => {
    if (selectedEntries.size === 0) return;
    setIsSubmitting(true);
    const ids = Array.from(selectedEntries).map((k) => Number(k));
    const r = await deletePacaEntries(ids);
    setIsSubmitting(false);
    if (r.success) {
      toast.success(`${r.data.deleted} entrada(s) eliminada(s)`);
      setSelectedEntries(new Set());
      setBulkDeleteOpen(false);
      router.refresh();
    } else toast.error(r.error);
  };

  const inventoryColumns: DataTableColumn<InventoryItem>[] = [
    {
      key: "category",
      header: "Categoría",
      cell: (item) => (
        <div className="flex items-center gap-2 min-w-0">
          <Package2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-foreground truncate">{item.category.name}</span>
        </div>
      ),
    },
    {
      key: "classification",
      header: "Clasificación",
      cell: (item) =>
        item.category.classification ? (
          <Badge variant="outline">{item.category.classification.name}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "available",
      header: "Disponible",
      align: "center",
      cell: (item) => (
        <Badge
          variant={
            item.available === 0
              ? "destructive"
              : item.available <= 5
                ? "warning"
                : "success"
          }
          className="font-mono tabular-nums"
        >
          {item.available}
        </Badge>
      ),
    },
    {
      key: "reserved",
      header: "Reserv.",
      align: "center",
      cell: (item) =>
        item.reserved > 0 ? (
          <Badge variant="info" className="font-mono tabular-nums">
            {item.reserved}
          </Badge>
        ) : (
          <span className="text-muted-foreground tabular-nums">0</span>
        ),
    },
    {
      key: "sold",
      header: "Vendida",
      align: "center",
      cell: (item) => (
        <span className="text-muted-foreground tabular-nums text-sm">{item.sold}</span>
      ),
    },
    {
      key: "avgCost",
      header: "Costo/U",
      align: "right",
      cell: (item) => {
        const inStock = item.available + item.reserved;
        const avg = inStock > 0 ? Number(item.totalCost) / inStock : 0;
        return (
          <span className="font-mono tabular-nums text-sm">
            {avg > 0 ? `$${avg.toFixed(2)}` : "—"}
          </span>
        );
      },
    },
    {
      key: "stockValue",
      header: "Valor stock",
      align: "right",
      cell: (item) => {
        const v = Number(item.totalCost);
        return (
          <span className="font-mono tabular-nums font-semibold text-foreground">
            {v > 0 ? `$${v.toFixed(2)}` : "—"}
          </span>
        );
      },
    },
  ];

  const entryColumns: DataTableColumn<EntryItem>[] = [
    {
      key: "category",
      header: "Categoría",
      cell: (e) => <span className="font-medium text-foreground">{e.category.name}</span>,
    },
    {
      key: "qty",
      header: "Cantidad",
      align: "right",
      cell: (e) => (
        <Badge variant="success" className="font-mono tabular-nums">
          +{e.quantity}
        </Badge>
      ),
    },
    {
      key: "price",
      header: "Precio",
      align: "right",
      cell: (e) =>
        e.purchasePrice ? (
          <span className="font-mono tabular-nums text-sm">${String(e.purchasePrice)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "supplier",
      header: "Proveedor",
      cell: (e) => (
        <span className="text-sm text-muted-foreground line-clamp-1">{e.supplier ?? "—"}</span>
      ),
    },
    {
      key: "date",
      header: "Fecha",
      cell: (e) => (
        <span className="font-mono tabular-nums text-xs text-muted-foreground">
          {e.arrivalDate ?? new Date(e.createdAt).toLocaleDateString("es-ES")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-12",
      cell: (e) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          onClick={(ev) => {
            ev.stopPropagation();
            setEntryToDelete(e.entryId);
          }}
          aria-label="Eliminar entrada"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const activeFilters =
    (classFilter !== ALL ? 1 : 0) + (stockFilter !== ALL ? 1 : 0);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Package2}
        title="Inventario de pacas"
        description="Stock por categoría con seguimiento de disponibles, reservadas y vendidas."
      >
        <Button variant="brand" onClick={() => setIsEntryOpen(true)}>
          <Plus className="h-4 w-4" />
          Registrar entrada
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricTile
          label="Disponibles"
          value={totalAvailable}
          icon={CircleCheck}
          tone="success"
        />
        <MetricTile
          label="Reservadas"
          value={totalReserved}
          icon={Bookmark}
          tone="active"
        />
        <MetricTile
          label="Vendidas"
          value={totalSold}
          icon={HandCoins}
          tone="idle"
        />
        <MetricTile
          label="Valor stock"
          value={`$${totalValue.toFixed(0)}`}
          icon={CircleDollarSign}
          tone="warning"
        />
      </div>

      {lowStock > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--ops-warning)]/30 bg-[var(--ops-warning)]/5 px-3 py-2 text-sm text-foreground">
          <AlertTriangle className="h-4 w-4 text-[var(--ops-warning)]" />
          <span>
            <strong>{lowStock}</strong> categoría(s) con stock bajo (&le; 5 unidades).
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-xs"
            onClick={() => setStockFilter("low")}
          >
            Ver
          </Button>
        </div>
      )}

      <DataTable
        columns={inventoryColumns}
        rows={filteredInventory}
        rowKey={(i) => i.categoryId}
        density="compact"
        toolbar={
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-headline text-sm font-semibold flex-1">
                Inventario por categoría
              </h3>
              <Badge variant="outline">{filteredInventory.length}</Badge>
            </div>
            <InputGroup className="flex-1 min-w-[240px]">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Buscar categoría o clasificación…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <Badge variant="brand">{filteredInventory.length}</Badge>
              </InputGroupAddon>
            </InputGroup>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ListFilter className="h-3.5 w-3.5" />
                Filtros
              </div>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[160px] text-xs">
                  <SelectValue placeholder="Clasificación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas las clasificaciones</SelectItem>
                  {classifications.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs">
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todo el stock</SelectItem>
                  <SelectItem value="low">Stock bajo (≤ 5)</SelectItem>
                  <SelectItem value="empty">Sin stock</SelectItem>
                </SelectContent>
              </Select>
              {activeFilters > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setClassFilter(ALL);
                    setStockFilter(ALL);
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
            title="Sin inventario"
            description={
              search || activeFilters > 0
                ? "No hay coincidencias con los filtros."
                : "Registra la primera entrada de pacas para empezar."
            }
          />
        }
      />

      <DataTable
        columns={entryColumns}
        rows={entries}
        rowKey={(e) => e.entryId}
        density="compact"
        selectedKeys={selectedEntries}
        onSelectionChange={setSelectedEntries}
        toolbar={
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <h3 className="font-headline text-sm font-semibold">Entradas recientes</h3>
              <Badge variant="outline">{entries.length}</Badge>
            </div>
            {selectedEntries.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-destructive hover:text-destructive"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar {selectedEntries.size}
              </Button>
            )}
          </div>
        }
        emptyState={
          <EmptyState title="Sin entradas" description="No hay entradas registradas todavía." />
        }
      />

      <PacaEntryForm
        open={isEntryOpen}
        onOpenChange={setIsEntryOpen}
        onSubmit={handleCreateEntry}
        isLoading={isSubmitting}
        categories={categories}
      />

      <AlertDialog open={!!entryToDelete} onOpenChange={() => setEntryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar entrada?</AlertDialogTitle>
            <AlertDialogDescription>
              Se descontarán las pacas del inventario disponible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEntry}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedEntries.size} entrada(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Se descontarán todas las pacas correspondientes del inventario disponible. Esta acción
              no se puede deshacer.
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
    </div>
  );
}
