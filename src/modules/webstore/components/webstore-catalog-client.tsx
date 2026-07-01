"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { MobileFilterSheet } from "@/components/ui/mobile-filter-sheet";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Field } from "@/components/ui/field";
import type { DataTableColumn } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tags,
  Search,
  PackageSearch,
  Pencil,
  History,
  Tag,
  Loader2,
} from "lucide-react";
import { formatAmount } from "@/modules/envios/lib/format";
import {
  toggleWebstoreEnabled,
  toggleWebstoreFeatured,
  updateWebstorePrice,
} from "@/modules/webstore/actions/catalog-actions";
import type {
  CatalogRow,
  CatalogKpis,
} from "@/modules/webstore/queries/catalog-queries";
import type { ActionResult } from "@/types";
import { ProductPriceHistoryDialog } from "./product-price-history-dialog";
import { ProductDiscountsDialog } from "./product-discounts-dialog";

type EstadoFilter = "all" | "enabled" | "hidden";

interface Props {
  rows: CatalogRow[];
  kpis: CatalogKpis;
  categories: string[];
}

export function WebstoreCatalogClient({ rows, kpis, categories }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("all");
  const [onlyOnSale, setOnlyOnSale] = useState(false);
  const [onlyFeatured, setOnlyFeatured] = useState(false);

  const [priceRow, setPriceRow] = useState<CatalogRow | null>(null);
  const [priceValue, setPriceValue] = useState("");
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [historyProductId, setHistoryProductId] = useState<number | null>(null);
  const [historyProductName, setHistoryProductName] = useState<string | undefined>(undefined);
  const [discountsProductId, setDiscountsProductId] = useState<number | null>(null);
  const [discountsProductName, setDiscountsProductName] = useState<string | undefined>(undefined);
  const [pendingToggleId, setPendingToggleId] = useState<number | null>(null);

  const activeCount =
    (categoryFilter !== "all" ? 1 : 0) +
    (estadoFilter !== "all" ? 1 : 0) +
    (onlyOnSale ? 1 : 0) +
    (onlyFeatured ? 1 : 0);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (term) {
        const matches =
          r.name.toLowerCase().includes(term) ||
          (r.sku?.toLowerCase().includes(term) ?? false);
        if (!matches) return false;
      }
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (estadoFilter === "enabled" && !r.webstoreEnabled) return false;
      if (estadoFilter === "hidden" && r.webstoreEnabled) return false;
      if (onlyOnSale && !r.onSale) return false;
      if (onlyFeatured && !r.webstoreFeatured) return false;
      return true;
    });
  }, [rows, search, categoryFilter, estadoFilter, onlyOnSale, onlyFeatured]);

  const clearFilters = () => {
    setCategoryFilter("all");
    setEstadoFilter("all");
    setOnlyOnSale(false);
    setOnlyFeatured(false);
  };

  const handle = (res: ActionResult<void>, successMessage = "Guardado") => {
    if (res.success) {
      toast.success(successMessage);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  const onToggleEnabled = async (row: CatalogRow, next: boolean) => {
    setPendingToggleId(row.productId);
    try {
      const res = await toggleWebstoreEnabled(row.productId, next);
      handle(res, next ? "Producto visible en tienda" : "Producto oculto de la tienda");
    } catch {
      toast.error("No se pudo actualizar la visibilidad del producto.");
    } finally {
      setPendingToggleId(null);
    }
  };

  const onToggleFeatured = async (row: CatalogRow, next: boolean) => {
    setPendingToggleId(row.productId);
    try {
      const res = await toggleWebstoreFeatured(row.productId, next);
      handle(res, next ? "Marcado como destacado" : "Ya no está destacado");
    } catch {
      toast.error("No se pudo actualizar la oferta destacada.");
    } finally {
      setPendingToggleId(null);
    }
  };

  const openPriceDialog = (row: CatalogRow) => {
    setPriceRow(row);
    setPriceValue(row.salePrice ?? "");
  };

  const submitPrice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!priceRow) return;
    const parsed = Number(priceValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Ingresa un precio válido.");
      return;
    }
    setIsSavingPrice(true);
    try {
      const res = await updateWebstorePrice(priceRow.productId, parsed);
      if (res.success) {
        toast.success("Precio actualizado");
        setPriceRow(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("No se pudo actualizar el precio.");
    } finally {
      setIsSavingPrice(false);
    }
  };

  const openHistory = (row: CatalogRow) => {
    setHistoryProductId(row.productId);
    setHistoryProductName(row.name);
  };

  const openDiscounts = (row: CatalogRow) => {
    setDiscountsProductId(row.productId);
    setDiscountsProductName(row.name);
  };

  const renderPrice = (row: CatalogRow) =>
    row.onSale ? (
      <div className="flex flex-col items-end leading-tight">
        <span className="font-mono tabular-nums text-xs text-muted-foreground line-through">
          {formatAmount(row.basePrice)}
        </span>
        <span className="font-mono tabular-nums text-[var(--success)] font-semibold">
          {formatAmount(row.finalPrice)}
        </span>
      </div>
    ) : (
      <span className="font-mono tabular-nums">{formatAmount(row.finalPrice)}</span>
    );

  const renderActions = (row: CatalogRow) => (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        title="Editar precio"
        onClick={() => openPriceDialog(row)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        title="Historial de precios"
        onClick={() => openHistory(row)}
      >
        <History className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        title="Descuentos"
        onClick={() => openDiscounts(row)}
      >
        <Tag className="h-4 w-4" />
      </Button>
    </div>
  );

  const columns: DataTableColumn<CatalogRow>[] = [
    {
      key: "product",
      header: "Producto",
      cell: (row) => (
        <div className="flex items-center gap-3 min-w-0">
          {row.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.imageUrl}
              alt={row.name}
              className="h-10 w-10 rounded-md object-cover shrink-0 border border-border"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted shrink-0 border border-border">
              <PackageSearch className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">{row.name}</div>
            {row.sku && <div className="text-xs text-muted-foreground truncate">{row.sku}</div>}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Categoría",
      cell: (row) => row.category ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: "price",
      header: "Precio",
      align: "right",
      cell: renderPrice,
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      cell: (row) => <span className="font-mono tabular-nums">{row.stockAvailable}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill
            status={row.webstoreEnabled ? "active" : "inactive"}
            label={row.webstoreEnabled ? "En tienda" : "Oculto"}
            size="sm"
          />
          {row.webstoreFeatured && <Badge variant="brand">Destacado</Badge>}
        </div>
      ),
    },
    {
      key: "visibilidad",
      header: "Visibilidad",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">En tienda</span>
            <Switch
              checked={row.webstoreEnabled}
              disabled={pendingToggleId === row.productId}
              onCheckedChange={(next) => onToggleEnabled(row, next)}
              aria-label="Disponible en tienda"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Destacado</span>
            <Switch
              checked={row.webstoreFeatured}
              disabled={pendingToggleId === row.productId}
              onCheckedChange={(next) => onToggleFeatured(row, next)}
              aria-label="Producto destacado"
            />
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      cell: renderActions,
    },
  ];

  const mobileCard = (row: CatalogRow) => (
    <MobileListCard
      key={row.productId}
      title={row.name}
      subtitle={row.sku ?? undefined}
      value={
        row.onSale ? (
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[10px] text-muted-foreground line-through">
              {formatAmount(row.basePrice)}
            </span>
            <span className="text-[var(--success)]">{formatAmount(row.finalPrice)}</span>
          </div>
        ) : (
          formatAmount(row.finalPrice)
        )
      }
      meta={
        <>
          <StatusPill
            status={row.webstoreEnabled ? "active" : "inactive"}
            label={row.webstoreEnabled ? "En tienda" : "Oculto"}
            size="sm"
          />
          {row.webstoreFeatured && <Badge variant="brand">Destacado</Badge>}
          <span className="text-xs text-muted-foreground">Stock: {row.stockAvailable}</span>
        </>
      }
      actions={
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Tienda</span>
            <Switch
              checked={row.webstoreEnabled}
              disabled={pendingToggleId === row.productId}
              onCheckedChange={(next) => onToggleEnabled(row, next)}
              aria-label="Disponible en tienda"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Destacado</span>
            <Switch
              checked={row.webstoreFeatured}
              disabled={pendingToggleId === row.productId}
              onCheckedChange={(next) => onToggleFeatured(row, next)}
              aria-label="Producto destacado"
            />
          </div>
          {renderActions(row)}
        </div>
      }
    />
  );

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Tags}
        title="Catálogo de tienda"
        description="Gestiona precios, ofertas y visibilidad de los productos en la tienda en línea."
        badge={`${rows.length} productos`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="En tienda" value={kpis.enabled} icon={Tags} accent="brand" size="compact" />
        <KpiCard label="Con oferta" value={kpis.onSale} icon={Tag} accent="success" size="compact" />
        <KpiCard label="Destacados" value={kpis.featured} icon={Tags} accent="warning" size="compact" />
        <KpiCard label="Mostrando" value={filtered.length} icon={Search} accent="info" size="compact" />
      </div>

      <ResponsiveListView<CatalogRow>
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.productId}
        mobileCard={mobileCard}
        toolbar={
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <MobileFilterSheet activeCount={activeCount} onClear={clearFilters}>
              <Field label="Categoría">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Estado">
                <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v as EstadoFilter)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="enabled">En tienda</SelectItem>
                    <SelectItem value="hidden">Oculto</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Con oferta">
                <div className="flex items-center gap-3">
                  <Switch checked={onlyOnSale} onCheckedChange={setOnlyOnSale} aria-label="Con oferta" />
                  <span className="text-sm text-muted-foreground">{onlyOnSale ? "Sí" : "No"}</span>
                </div>
              </Field>
              <Field label="Destacado">
                <div className="flex items-center gap-3">
                  <Switch checked={onlyFeatured} onCheckedChange={setOnlyFeatured} aria-label="Destacado" />
                  <span className="text-sm text-muted-foreground">{onlyFeatured ? "Sí" : "No"}</span>
                </div>
              </Field>
            </MobileFilterSheet>
          </div>
        }
        emptyState={
          <EmptyState
            icon={<PackageSearch className="size-10" />}
            title="Sin productos"
            description="Ajusta los filtros de búsqueda para ver más productos."
          />
        }
      />

      <ResponsiveFormDialog
        open={!!priceRow}
        onOpenChange={(o) => !o && setPriceRow(null)}
        title="Editar precio"
        description={priceRow?.name}
        showHeader
      >
        <form onSubmit={submitPrice} className="space-y-5">
          <Field label="Precio de venta" required hint="Precio final que verán los clientes en la tienda.">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
              required
              placeholder="$0.00"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setPriceRow(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={isSavingPrice}>
              {isSavingPrice && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSavingPrice ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </ResponsiveFormDialog>

      <ProductPriceHistoryDialog
        productId={historyProductId}
        productName={historyProductName}
        onOpenChange={(o) => !o && setHistoryProductId(null)}
      />

      <ProductDiscountsDialog
        productId={discountsProductId}
        productName={discountsProductName}
        onOpenChange={(o) => !o && setDiscountsProductId(null)}
      />
    </div>
  );
}
