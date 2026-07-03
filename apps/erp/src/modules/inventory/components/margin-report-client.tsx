"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { MobileFilterSheet } from "@/components/ui/mobile-filter-sheet";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DataTableColumn } from "@/components/ui/data-table";
import {
  Percent,
  TrendingDown,
  AlertTriangle,
  CircleDollarSign,
  Warehouse as WarehouseIcon,
  ShieldAlert,
} from "lucide-react";
import { formatAmount } from "@/lib/format";
import type {
  MarginReportRow,
  MarginReportSummary,
} from "../queries/margin-report-queries";

interface WarehouseOption {
  warehouseId: number;
  name: string;
}

interface Props {
  rows: MarginReportRow[];
  summary: MarginReportSummary;
  warehouses: WarehouseOption[];
  selectedWarehouseId: number | null;
  onlyWarnings: boolean;
}

function marginToneClass(warning: MarginReportRow["warning"]): string {
  if (warning === "negative") return "text-[var(--ops-critical)]";
  if (warning === "low") return "text-[var(--ops-warning)]";
  return "text-[var(--ops-success)]";
}

function formatPct(value: number | null): string {
  if (value == null) return "—";
  const sign = value < 0 ? "−" : "+";
  return `${sign}${formatAmount(Math.abs(value), 1)}%`;
}

function formatCup(value: number | null): string {
  if (value == null) return "—";
  return `${formatAmount(value, 0)} CUP`;
}

export function MarginReportClient({
  rows,
  summary,
  warehouses,
  selectedWarehouseId,
  onlyWarnings,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const buildQs = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "all") next.delete(k);
      else next.set(k, v);
    }
    return next.toString();
  };

  const goTo = (patch: Record<string, string | null>) => {
    const qs = buildQs(patch);
    router.push(qs ? `/margins?${qs}` : "/margins");
  };

  const activeFilterCount = (selectedWarehouseId != null ? 1 : 0) + (onlyWarnings ? 1 : 0);

  const filterControls = (
    <>
      <Field label="Almacén" icon={WarehouseIcon}>
        <Select
          value={selectedWarehouseId != null ? String(selectedWarehouseId) : "all"}
          onValueChange={(v) => goTo({ warehouseId: v === "all" ? null : v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los almacenes</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.warehouseId} value={String(w.warehouseId)}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Solo alertas" icon={ShieldAlert}>
        <div className="flex items-center gap-2 pt-1">
          <Switch
            checked={onlyWarnings}
            onCheckedChange={(checked) => goTo({ onlyWarnings: checked ? "1" : null })}
          />
          <span className="text-sm text-muted-foreground">
            Márgenes negativos o bajos
          </span>
        </div>
      </Field>
    </>
  );

  const columns: DataTableColumn<MarginReportRow>[] = [
    {
      key: "product",
      header: "Producto",
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate">{r.productName}</div>
          {r.sku && <div className="text-xs text-muted-foreground">{r.sku}</div>}
        </div>
      ),
    },
    {
      key: "price",
      header: "Precio",
      align: "right",
      cell: (r) => (
        <span className="font-mono tabular-nums">{formatCup(r.priceBase)}</span>
      ),
    },
    {
      key: "accountingCost",
      header: "Costo contable",
      align: "right",
      cell: (r) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatCup(r.accountingCostBase)}
        </span>
      ),
    },
    {
      key: "replacementCost",
      header: "Costo reposición",
      align: "right",
      cell: (r) => (
        <div className="text-right">
          <span className="font-mono tabular-nums text-muted-foreground">
            {formatCup(r.replacementCostBase)}
          </span>
          {r.purchaseCurrencyCode && (
            <div className="text-[10px] text-muted-foreground">{r.purchaseCurrencyCode}</div>
          )}
        </div>
      ),
    },
    {
      key: "marginPct",
      header: "Margen contable",
      align: "right",
      cell: (r) => (
        <span className="font-mono tabular-nums font-medium text-foreground">
          {formatPct(r.marginPct)}
        </span>
      ),
    },
    {
      key: "replacementMarginPct",
      header: "Margen reposición",
      align: "right",
      cell: (r) => (
        <span className={`font-mono tabular-nums font-semibold ${marginToneClass(r.warning)}`}>
          {formatPct(r.replacementMarginPct)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Márgenes"
        description="Margen de venta vs. costo contable y costo de reposición, por producto."
        badge={`${summary.totalProducts} productos`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Margen negativo"
          value={summary.negativeCount}
          icon={TrendingDown}
          accent={summary.negativeCount > 0 ? "danger" : "slate"}
        />
        <KpiCard
          label="Margen bajo"
          value={summary.lowCount}
          icon={AlertTriangle}
          accent={summary.lowCount > 0 ? "warning" : "slate"}
        />
        <KpiCard
          label="Margen promedio (reposición)"
          value={
            summary.avgReplacementMarginPct != null
              ? formatPct(summary.avgReplacementMarginPct)
              : "—"
          }
          icon={Percent}
          accent="info"
        />
        <KpiCard
          label="Productos evaluados"
          value={summary.totalProducts}
          icon={CircleDollarSign}
          accent="brand"
        />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <div className="hidden sm:flex flex-1 flex-wrap items-center gap-3">
            <div className="w-[220px]">{filterControls}</div>
          </div>
          <div className="sm:hidden">
            <MobileFilterSheet
              activeCount={activeFilterCount}
              onClear={() => router.push("/margins")}
            >
              <div className="space-y-4">{filterControls}</div>
            </MobileFilterSheet>
          </div>
          <Badge variant="outline" className="ml-auto">
            {rows.length}
          </Badge>
        </div>

        <div className="p-3">
          <ResponsiveListView<MarginReportRow>
            columns={columns}
            rows={rows}
            rowKey={(r) => r.productId}
            onRowClick={(r) => router.push(`/products?productId=${r.productId}`)}
            emptyState={
              <EmptyState
                title="Sin datos de margen"
                description="No hay productos activos con precio para evaluar."
              />
            }
            mobileCard={(r) => (
              <MobileListCard
                title={r.productName}
                subtitle={r.sku ?? undefined}
                onClick={() => router.push(`/products?productId=${r.productId}`)}
                value={
                  <span className={`font-mono tabular-nums ${marginToneClass(r.warning)}`}>
                    {formatPct(r.replacementMarginPct)}
                  </span>
                }
                meta={
                  <span className="font-mono tabular-nums text-[11px] text-muted-foreground">
                    {formatCup(r.priceBase)} · costo contable {formatCup(r.accountingCostBase)} ·
                    reposición {formatCup(r.replacementCostBase)}
                    {r.purchaseCurrencyCode && ` (${r.purchaseCurrencyCode})`}
                  </span>
                }
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}
