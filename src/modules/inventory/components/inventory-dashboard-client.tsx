"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { MetricTile } from "@/components/ui/metric-tile";
import { Spark } from "@/components/ui/spark";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Boxes,
  Package,
  Warehouse,
  CircleDollarSign,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Wrench,
  TrendingUp,
  AlertTriangle,
  PackageOpen,
  PackagePlus,
  Plus,
  PackageSearch,
} from "lucide-react";
import { MOVEMENT_TYPES, getUnitAbbreviation } from "@/lib/constants";
import type { InventoryDashboardData } from "../queries/inventory-dashboard-queries";

interface Props {
  data: InventoryDashboardData;
}

const MOVEMENT_ICON: Record<string, typeof ArrowDownToLine> = {
  entry: ArrowDownToLine,
  exit: ArrowUpFromLine,
  transfer: ArrowLeftRight,
  adjustment: Wrench,
};

const MOVEMENT_BG: Record<string, string> = {
  entry: "bg-[var(--ops-success)]/10 text-[var(--ops-success)]",
  exit: "bg-[var(--ops-critical)]/10 text-[var(--ops-critical)]",
  transfer: "bg-[var(--ops-active)]/10 text-[var(--ops-active)]",
  adjustment: "bg-[var(--ops-warning)]/12 text-[var(--ops-warning)]",
};

function getMovementLabel(type: string) {
  return MOVEMENT_TYPES.find((m) => m.value === type)?.label ?? type;
}

export function InventoryDashboardClient({ data }: Props) {
  const router = useRouter();
  const { counts, alerts, movements30, recentMovements, byWarehouse, topByValue } = data;

  const totalAlerts = alerts.low.length + alerts.over.length + alerts.out.length;
  const maxWarehouseValue = Math.max(1, ...byWarehouse.map((w) => w.value));
  const maxTopValue = Math.max(1, ...topByValue.map((p) => p.value));

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Boxes}
        title="Cockpit de inventario"
        description="Stock, valuación y movimientos en tiempo real — control operativo de productos y almacenes."
        badge="Últimos 30 días"
      >
        <Button variant="outline" onClick={() => router.push("/stock")}>
          <PackageSearch className="h-4 w-4" /> Ver stock
        </Button>
        <Button variant="brand" onClick={() => router.push("/products")}>
          <Plus className="h-4 w-4" /> Nuevo producto
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Valor del inventario"
          value={`$${counts.totalValue.toFixed(0)}`}
          icon={CircleDollarSign}
          accent="brand"
        />
        <KpiCard
          label="Productos activos"
          value={counts.productsActive}
          icon={Package}
          accent="success"
        />
        <KpiCard
          label="Movimientos (30d)"
          value={movements30.total}
          icon={TrendingUp}
          spark={movements30.spark14}
          accent="info"
        />
        <KpiCard
          label="Alertas de stock"
          value={totalAlerts}
          icon={AlertTriangle}
          accent={totalAlerts > 0 ? "warning" : "slate"}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricTile
          label="Almacenes"
          value={counts.warehouses}
          icon={Warehouse}
          tone="active"
        />
        <MetricTile
          label="SKUs con stock"
          value={counts.skusWithStock}
          icon={PackageOpen}
          tone="success"
        />
        <MetricTile
          label="Stock bajo"
          value={alerts.low.length}
          icon={AlertTriangle}
          tone="warning"
        />
        <MetricTile
          label="Agotados"
          value={alerts.out.length}
          icon={PackageOpen}
          tone={alerts.out.length > 0 ? "critical" : "idle"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Movements trend */}
        <div className="cockpit-panel p-4 sm:p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[var(--ops-active)]" />
              Tendencia de movimientos (14 días)
            </h2>
            <Badge variant="brand">{movements30.spark14.reduce((a, n) => a + n, 0)} mov.</Badge>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <Spark data={movements30.spark14} color="#06b6d4" height={96} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <MetricTile
              label="Entradas"
              value={movements30.entries}
              icon={ArrowDownToLine}
              tone="success"
            />
            <MetricTile
              label="Salidas"
              value={movements30.exits}
              icon={ArrowUpFromLine}
              tone="critical"
            />
            <MetricTile
              label="Transferencias"
              value={movements30.transfers}
              icon={ArrowLeftRight}
              tone="active"
            />
            <MetricTile
              label="Ajustes"
              value={movements30.adjustments}
              icon={Wrench}
              tone="warning"
            />
          </div>
        </div>

        {/* Stock distribution by warehouse */}
        <div className="cockpit-panel p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-[var(--ops-track)]" />
              Valor por almacén
            </h2>
            <Badge variant="outline">{byWarehouse.length}</Badge>
          </div>
          {byWarehouse.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin almacenes con stock.</p>
          ) : (
            <ul className="space-y-2.5">
              {byWarehouse.map((w) => {
                const pct = (w.value / maxWarehouseValue) * 100;
                return (
                  <li key={w.warehouseId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground truncate">{w.name}</span>
                      <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                        ${w.value.toFixed(0)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-[var(--ops-active)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {w.skus} SKUs · {w.qty.toFixed(0)} unidades
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top products by value */}
        <div className="cockpit-panel p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-[var(--ops-success)]" />
              Top productos por valor
            </h2>
            <Badge variant="outline">{topByValue.length}</Badge>
          </div>
          {topByValue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin productos con valor.</p>
          ) : (
            <ul className="space-y-2.5">
              {topByValue.map((p) => {
                const pct = (p.value / maxTopValue) * 100;
                return (
                  <li key={p.productId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">{p.name}</span>
                        {p.category && (
                          <Badge variant="outline" className="text-[10px]">
                            {p.category}
                          </Badge>
                        )}
                      </div>
                      <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                        ${p.value.toFixed(0)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-[var(--ops-success)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {p.qty.toFixed(0)} {getUnitAbbreviation(p.unit)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent movements */}
        <div className="cockpit-panel p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[var(--ops-active)]" />
              Movimientos recientes
            </h2>
            <Button variant="ghost" size="sm" onClick={() => router.push("/stock")}>
              Ver todos
            </Button>
          </div>
          {recentMovements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
          ) : (
            <ul className="divide-y divide-border/60 -mx-1">
              {recentMovements.map((m) => {
                const Icon = MOVEMENT_ICON[m.movementType] ?? ArrowDownToLine;
                const bg = MOVEMENT_BG[m.movementType] ?? MOVEMENT_BG.transfer;
                return (
                  <li
                    key={m.movementId}
                    className="px-1 py-2 flex items-center gap-3"
                  >
                    <span
                      className={`grid size-8 place-items-center rounded-md shrink-0 ${bg}`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">
                        {m.productName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {getMovementLabel(m.movementType)} · {m.warehouseName}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums text-sm font-semibold text-foreground">
                        {m.quantity.toFixed(2)} {getUnitAbbreviation(m.unit)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(m.createdAt).toLocaleDateString("es-ES")}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Stock alerts */}
      {(alerts.out.length > 0 || alerts.low.length > 0 || alerts.over.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {alerts.out.length > 0 && (
            <div className="cockpit-panel p-4 sm:p-5 space-y-3 ring-1 ring-[var(--ops-critical)]/30">
              <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
                <PackageOpen className="h-4 w-4 text-[var(--ops-critical)]" />
                Productos agotados
                <Badge variant="destructive" className="ml-auto">
                  {alerts.out.length}
                </Badge>
              </h2>
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {alerts.out.slice(0, 12).map((a) => (
                  <li
                    key={`${a.productId}-${a.warehouseId}`}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{a.productName}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {a.warehouseName}
                      </div>
                    </div>
                    <StatusPill status="cancelled" size="sm" label="0" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {alerts.low.length > 0 && (
            <div className="cockpit-panel p-4 sm:p-5 space-y-3 ring-1 ring-[var(--ops-warning)]/30">
              <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[var(--ops-warning)]" />
                Stock bajo
                <Badge variant="warning" className="ml-auto">
                  {alerts.low.length}
                </Badge>
              </h2>
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {alerts.low.slice(0, 12).map((a) => (
                  <li
                    key={`${a.productId}-${a.warehouseId}`}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{a.productName}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {a.warehouseName} · min {a.min} {getUnitAbbreviation(a.unit)}
                      </div>
                    </div>
                    <span className="font-mono tabular-nums text-sm font-semibold text-[var(--ops-warning)] shrink-0">
                      {a.qty}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {alerts.over.length > 0 && (
            <div className="cockpit-panel p-4 sm:p-5 space-y-3">
              <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
                <PackagePlus className="h-4 w-4 text-[var(--ops-track)]" />
                Sobrestock
                <Badge variant="info" className="ml-auto">
                  {alerts.over.length}
                </Badge>
              </h2>
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {alerts.over.slice(0, 12).map((a) => (
                  <li
                    key={`${a.productId}-${a.warehouseId}`}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{a.productName}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {a.warehouseName} · max {a.max} {getUnitAbbreviation(a.unit)}
                      </div>
                    </div>
                    <span className="font-mono tabular-nums text-sm font-semibold text-[var(--ops-track)] shrink-0">
                      {a.qty}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
