"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { ToastDelta } from "@/components/ui/toast-content";
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
  Layers,
  Loader2,
  Store,
  Star,
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
import type { ModelGroupRow } from "@/modules/webstore/queries/model-group-queries";
import type { ActionResult } from "@/types";
import { ProductPriceHistoryDialog } from "./product-price-history-dialog";
import { ProductDiscountsDialog } from "./product-discounts-dialog";
import { ModelGroupDialog } from "./model-group-dialog";

type EstadoFilter = "all" | "enabled" | "hidden";

interface Props {
  rows: CatalogRow[];
  kpis: CatalogKpis;
  categories: string[];
  groups: ModelGroupRow[];
  isAdmin?: boolean;
}

export function WebstoreCatalogClient({ rows, kpis, categories, groups, isAdmin = false }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("all");
  const [onlyOnSale, setOnlyOnSale] = useState(false);
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [onlyGrouped, setOnlyGrouped] = useState(false);

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  // Se guarda el id, no el objeto: así el dialog lee siempre la `version`
  // más reciente que llega con router.refresh() (evita STALE_VERSION falsos).
  const [dialogGroupId, setDialogGroupId] = useState<number | null>(null);
  const [dialogInitialProduct, setDialogInitialProduct] = useState<CatalogRow | null>(null);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.groupId, g])), [groups]);
  const dialogGroup = dialogGroupId != null ? groupById.get(dialogGroupId) ?? null : null;

  // Grupos cuyos modelos ya no están en el catálogo (inactivos o borrados):
  // sin una fila que los abra quedarían inalcanzables.
  const orphanGroups = useMemo(() => {
    const rowIds = new Set(rows.map((r) => r.productId));
    return groups.filter((g) => !g.members.some((m) => rowIds.has(m.productId)));
  }, [groups, rows]);

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
    (onlyFeatured ? 1 : 0) +
    (onlyGrouped ? 1 : 0);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (term) {
        const matches =
          r.name.toLowerCase().includes(term) ||
          (r.sku?.toLowerCase().includes(term) ?? false) ||
          (r.modelGroupName?.toLowerCase().includes(term) ?? false) ||
          (r.modelLabel?.toLowerCase().includes(term) ?? false);
        if (!matches) return false;
      }
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (estadoFilter === "enabled" && !r.webstoreEnabled) return false;
      if (estadoFilter === "hidden" && r.webstoreEnabled) return false;
      if (onlyOnSale && !r.onSale) return false;
      if (onlyFeatured && !r.webstoreFeatured) return false;
      if (onlyGrouped && r.modelGroupId == null) return false;
      return true;
    });
  }, [rows, search, categoryFilter, estadoFilter, onlyOnSale, onlyFeatured, onlyGrouped]);

  const clearFilters = () => {
    setCategoryFilter("all");
    setEstadoFilter("all");
    setOnlyOnSale(false);
    setOnlyFeatured(false);
    setOnlyGrouped(false);
  };

  const openNewGroup = () => {
    setDialogGroupId(null);
    setDialogInitialProduct(null);
    setGroupDialogOpen(true);
  };

  const openGroup = (groupId: number) => {
    setDialogGroupId(groupId);
    setDialogInitialProduct(null);
    setGroupDialogOpen(true);
  };

  const groupingIssue = (row: CatalogRow): string | null =>
    row.isService
      ? "Los servicios no se agrupan como modelos"
      : !row.sku
        ? "Asigna un SKU para agrupar este producto"
        : null;

  const openGroupFor = (row: CatalogRow) => {
    if (row.modelGroupId != null && groupById.has(row.modelGroupId)) {
      openGroup(row.modelGroupId);
      return;
    }
    const issue = groupingIssue(row);
    if (issue) {
      toast.error(issue);
      return;
    }
    setDialogGroupId(null);
    setDialogInitialProduct(row);
    setGroupDialogOpen(true);
  };

  const onGroupSaved = () => {
    setGroupDialogOpen(false);
    router.refresh();
  };

  const onGroupStale = () => {
    setGroupDialogOpen(false);
    router.refresh();
  };

  const renderGroupBadge = (row: CatalogRow) => {
    if (!row.modelGroupName) return null;
    const text = `${row.modelGroupName} · ${row.modelLabel}`;
    return (
      <button
        type="button"
        onClick={() => setSearch(row.modelGroupName ?? "")}
        title={`${text} — filtrar por este grupo`}
        className="shrink-0 min-w-0 rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Badge variant="info" className="text-[10px] max-w-[12rem]">
          <Layers aria-hidden />
          <span className="min-w-0 truncate">{text}</span>
        </Badge>
      </button>
    );
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
        const previous =
          priceRow.salePrice && priceRow.salePrice !== ""
            ? Number(priceRow.salePrice)
            : priceRow.basePrice;
        toast.success("Precio actualizado", {
          description: (
            <ToastDelta
              from={formatAmount(previous)}
              to={formatAmount(parsed)}
            />
          ),
        });
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

  const renderThumbnail = (row: CatalogRow, size: "sm" | "lg" = "sm") => {
    const box = size === "lg" ? "h-14 w-14 rounded-lg" : "h-10 w-10 rounded-md";
    return row.imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={row.imageUrl}
        alt={row.name}
        className={cn(
          box,
          "object-cover shrink-0 border border-border",
          !row.webstoreEnabled && "grayscale opacity-60"
        )}
      />
    ) : (
      <div
        className={cn(
          box,
          "flex items-center justify-center bg-muted shrink-0 border border-border"
        )}
      >
        <PackageSearch className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  };

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
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "size-8",
          row.modelGroupId != null && "text-[var(--info)]",
          row.modelGroupId == null && groupingIssue(row) && "text-muted-foreground/50"
        )}
        title={
          groupingIssue(row) ??
          (row.modelGroupId != null ? "Editar grupo de modelos" : "Agrupar como modelos")
        }
        aria-label="Modelos"
        onClick={() => openGroupFor(row)}
      >
        <Layers className="h-4 w-4" />
      </Button>
    </div>
  );

  const columns: DataTableColumn<CatalogRow>[] = [
    {
      key: "product",
      header: "Producto",
      cell: (row) => (
        <div className="flex items-center gap-3 min-w-0">
          {renderThumbnail(row)}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-medium text-foreground truncate">{row.name}</span>
              {row.presentationCount > 0 && (
                <Badge variant="outline" className="shrink-0 text-[10px]" title="Presentaciones activas">
                  {row.presentationCount} present.
                </Badge>
              )}
              {renderGroupBadge(row)}
            </div>
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
          <div className="flex items-center gap-1.5" title="Disponible en tienda">
            <Store
              aria-hidden
              className={cn(
                "h-3.5 w-3.5",
                row.webstoreEnabled ? "text-[var(--brand)]" : "text-muted-foreground"
              )}
            />
            <Switch
              checked={row.webstoreEnabled}
              disabled={pendingToggleId === row.productId}
              onCheckedChange={(next) => onToggleEnabled(row, next)}
              aria-label="Disponible en tienda"
            />
          </div>
          <div className="flex items-center gap-1.5" title="Producto destacado">
            <Star
              aria-hidden
              className={cn(
                "h-3.5 w-3.5",
                row.webstoreFeatured
                  ? "fill-[var(--warning)] text-[var(--warning)]"
                  : "text-muted-foreground"
              )}
            />
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
      leading={renderThumbnail(row, "lg")}
      title={
        <span className={cn(!row.webstoreEnabled && "text-muted-foreground")}>
          {row.name}
        </span>
      }
      subtitle={row.sku ?? undefined}
      value={
        row.onSale ? (
          <div className="flex flex-col items-end leading-tight">
            <span className="font-mono tabular-nums text-[10px] font-normal text-muted-foreground line-through">
              {formatAmount(row.basePrice)}
            </span>
            <span className="font-mono tabular-nums text-[var(--success)]">
              {formatAmount(row.finalPrice)}
            </span>
          </div>
        ) : (
          <span className="font-mono tabular-nums">{formatAmount(row.finalPrice)}</span>
        )
      }
      meta={
        <>
          <StatusPill
            status={row.webstoreEnabled ? "active" : "inactive"}
            label={row.webstoreEnabled ? "En tienda" : "Oculto"}
            size="sm"
          />
          {row.onSale && <Badge variant="success">Oferta</Badge>}
          {row.webstoreFeatured && <Badge variant="brand">Destacado</Badge>}
          {row.presentationCount > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {row.presentationCount} present.
            </Badge>
          )}
          {renderGroupBadge(row)}
          <span className="ml-auto font-mono tabular-nums text-xs text-muted-foreground">
            Stock: {row.stockAvailable}
          </span>
        </>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label
              className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1.5"
              title="Disponible en tienda"
            >
              <Store
                aria-hidden
                className={cn(
                  "h-3.5 w-3.5",
                  row.webstoreEnabled ? "text-[var(--brand)]" : "text-muted-foreground"
                )}
              />
              <Switch
                checked={row.webstoreEnabled}
                disabled={pendingToggleId === row.productId}
                onCheckedChange={(next) => onToggleEnabled(row, next)}
                aria-label="Disponible en tienda"
              />
            </label>
            <label
              className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1.5"
              title="Producto destacado"
            >
              <Star
                aria-hidden
                className={cn(
                  "h-3.5 w-3.5",
                  row.webstoreFeatured
                    ? "fill-[var(--warning)] text-[var(--warning)]"
                    : "text-muted-foreground"
                )}
              />
              <Switch
                checked={row.webstoreFeatured}
                disabled={pendingToggleId === row.productId}
                onCheckedChange={(next) => onToggleFeatured(row, next)}
                aria-label="Producto destacado"
              />
            </label>
          </div>
          {renderActions(row)}
        </div>
      }
    />
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Catálogo de tienda"
        description="Gestiona precios, ofertas y visibilidad de los productos en la tienda en línea."
        badge={`${rows.length} productos`}
        actions={
          <Button type="button" variant="outline" onClick={openNewGroup}>
            <Layers className="h-4 w-4" />
            Nuevo grupo de modelos
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="En tienda" value={kpis.enabled} icon={Tags} accent="brand" size="compact" />
        <KpiCard label="Con oferta" value={kpis.onSale} icon={Tag} accent="success" size="compact" />
        <KpiCard label="Destacados" value={kpis.featured} icon={Tags} accent="warning" size="compact" />
        <KpiCard label="Con modelos" value={kpis.grouped} icon={Layers} accent="slate" size="compact" />
        <KpiCard label="Mostrando" value={filtered.length} icon={Search} accent="info" size="compact" />
      </div>

      {orphanGroups.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <p className="text-sm font-medium text-foreground">Grupos sin productos activos</p>
          <p className="text-xs text-muted-foreground">
            Sus modelos están inactivos o fueron eliminados. Ábrelos para reasignar productos o
            eliminarlos.
          </p>
          <div className="flex flex-wrap gap-2">
            {orphanGroups.map((g) => (
              <Button
                key={g.groupId}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openGroup(g.groupId)}
              >
                <Layers className="h-4 w-4" />
                <span className="max-w-[14rem] truncate">{g.name}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

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
              <Field label="Con modelos">
                <div className="flex items-center gap-3">
                  <Switch checked={onlyGrouped} onCheckedChange={setOnlyGrouped} aria-label="Con modelos" />
                  <span className="text-sm text-muted-foreground">{onlyGrouped ? "Sí" : "No"}</span>
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

      <ModelGroupDialog
        open={groupDialogOpen}
        group={dialogGroup}
        initialProduct={dialogInitialProduct}
        rows={rows}
        isAdmin={isAdmin}
        onOpenChange={setGroupDialogOpen}
        onSaved={onGroupSaved}
        onStale={onGroupStale}
      />
    </div>
  );
}
