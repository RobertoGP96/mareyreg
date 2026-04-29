"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { MetricTile } from "@/components/ui/metric-tile";
import { Spark } from "@/components/ui/spark";
import { StatusPill } from "@/components/ui/status-pill";
import { BentoGrid, BentoCell } from "@/components/ui/bento-grid";
import { FadeStagger, FadeStaggerItem } from "@/components/ui/motion";
import {
  Package2,
  CircleCheck,
  Bookmark,
  HandCoins,
  ShoppingBag,
  TrendingUp,
  Users,
  FolderTree,
  CalendarClock,
  CircleDollarSign,
  AlertTriangle,
  Plus,
} from "lucide-react";
import type { PacaDashboardData } from "../queries/paca-dashboard-queries";

interface Props {
  data: PacaDashboardData;
}

export function PacaDashboardClient({ data }: Props) {
  const router = useRouter();
  const { counts, sales30, reservations, topCategories } = data;

  const totalStock = counts.available + counts.reserved;
  const availPct = totalStock > 0 ? (counts.available / totalStock) * 100 : 0;
  const maxCat = Math.max(1, ...topCategories.map((c) => c.available + c.reserved + c.sold));

  return (
    <div className="space-y-5">
      <PageHeader
        variant="editorial"
        accentTitle="pacas"
        icon={ShoppingBag}
        title="Cockpit de pacas"
        description="Inventario, ventas y reservaciones de pacas — vista operativa en tiempo real."
        badge="Últimos 30 días"
        actions={
          <>
            <Button variant="outline" onClick={() => router.push("/pacas/disponibilidad")}>
              <CircleCheck className="h-4 w-4" /> Disponibilidad
            </Button>
            <Button variant="brand" onClick={() => router.push("/pacas")}>
              <Plus className="h-4 w-4" /> Registrar entrada
            </Button>
          </>
        }
      />

      <BentoGrid rowMin="md">
        <BentoCell colSpan={{ md: 3, lg: 6 }} rowSpan={{ md: 2, lg: 2 }}>
          <KpiCard
            label="Vendidas (30d)"
            value={sales30.units}
            icon={HandCoins}
            spark={sales30.spark14}
            accent="brand"
            size="hero"
            className="h-full"
          />
        </BentoCell>
        <BentoCell colSpan={{ md: 3, lg: 3 }}>
          <KpiCard
            label="Disponible"
            value={counts.available}
            icon={CircleCheck}
            accent="success"
            className="h-full"
          />
        </BentoCell>
        <BentoCell colSpan={{ md: 3, lg: 3 }}>
          <KpiCard
            label="Reservadas"
            value={counts.reserved}
            icon={Bookmark}
            accent="info"
            className="h-full"
          />
        </BentoCell>
        <BentoCell colSpan={{ md: 6, lg: 6 }}>
          <KpiCard
            label="Ingresos (30d)"
            value={`$${sales30.revenue.toFixed(0)}`}
            icon={TrendingUp}
            accent="warning"
            className="h-full"
          />
        </BentoCell>
      </BentoGrid>

      <FadeStagger className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <FadeStaggerItem>
          <MetricTile
            label="Valor stock"
            value={`$${counts.stockValue.toFixed(0)}`}
            icon={CircleDollarSign}
            tone="warning"
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <MetricTile
            label="Categorías"
            value={counts.categoriesCount}
            icon={FolderTree}
            tone="active"
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <MetricTile
            label="Reserv. activas"
            value={reservations.active}
            icon={Bookmark}
            tone="track"
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <MetricTile
            label="Clientes activos"
            value={counts.clientsActive}
            icon={Users}
            tone="success"
          />
        </FadeStaggerItem>
      </FadeStagger>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales trend */}
        <div className="cockpit-panel p-4 sm:p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[var(--ops-active)]" />
              Tendencia de ventas (14 días)
            </h2>
            <Badge variant="brand">{sales30.spark14.reduce((a, n) => a + n, 0)} unidades</Badge>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <Spark data={sales30.spark14} color="#2563eb" height={96} />
          </div>
        </div>

        {/* Stock distribution */}
        <div className="cockpit-panel p-4 sm:p-5 space-y-3">
          <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
            <Package2 className="h-4 w-4 text-[var(--ops-track)]" />
            Distribución de stock
          </h2>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Disponibles</span>
                <span className="font-mono tabular-nums text-foreground">
                  {counts.available} ({availPct.toFixed(0)}%)
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-[var(--ops-success)]"
                  style={{ width: `${availPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Reservadas</span>
                <span className="font-mono tabular-nums text-foreground">
                  {counts.reserved} (
                  {(totalStock > 0 ? (counts.reserved / totalStock) * 100 : 0).toFixed(0)}%)
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-[var(--ops-active)]"
                  style={{ width: `${100 - availPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Vendidas (acum.)</span>
                <span className="font-mono tabular-nums text-foreground">{counts.sold}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-[var(--ops-idle)]"
                  style={{
                    width: `${counts.total > 0 ? (counts.sold / counts.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top categories */}
        <div className="cockpit-panel p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-[var(--ops-active)]" />
              Top categorías por disponibilidad
            </h2>
            <Badge variant="outline">{topCategories.length}</Badge>
          </div>
          {topCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          ) : (
            <ul className="space-y-2.5">
              {topCategories.map((c) => {
                const total = c.available + c.reserved + c.sold;
                return (
                  <li key={c.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">{c.name}</span>
                        {c.classification && (
                          <Badge variant="outline" className="text-[10px]">
                            {c.classification}
                          </Badge>
                        )}
                      </div>
                      <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                        {c.available} disp · {c.reserved} res · {c.sold} vend
                      </span>
                    </div>
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
                      <div
                        className="bg-[var(--ops-success)]"
                        style={{ width: `${(c.available / maxCat) * 100}%` }}
                        title={`${c.available} disponibles`}
                      />
                      <div
                        className="bg-[var(--ops-active)]"
                        style={{ width: `${(c.reserved / maxCat) * 100}%` }}
                        title={`${c.reserved} reservadas`}
                      />
                      <div
                        className="bg-[var(--ops-idle)]"
                        style={{ width: `${(c.sold / maxCat) * 100}%` }}
                        title={`${c.sold} vendidas`}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Total histórico: {total}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent sales + expiring */}
        <div className="space-y-4">
          <div className="cockpit-panel p-4 sm:p-5 space-y-3">
            <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-[var(--ops-active)]" />
              Ventas recientes
            </h2>
            {sales30.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin ventas en los últimos 30 días.</p>
            ) : (
              <ul className="divide-y divide-border/60 -mx-1">
                {sales30.recent.map((s) => (
                  <li
                    key={s.saleId}
                    className="px-1 py-2 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">
                        {s.clientName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {s.category} · {s.saleDate}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums text-sm font-semibold text-[var(--ops-success)]">
                        ${s.total.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{s.quantity} pacas</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {reservations.expiringSoon.length > 0 && (
            <div className="cockpit-panel p-4 sm:p-5 space-y-3 ring-1 ring-[var(--ops-warning)]/30">
              <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[var(--ops-warning)]" />
                Reservaciones por vencer
              </h2>
              <ul className="space-y-2">
                {reservations.expiringSoon.map((r) => (
                  <li
                    key={r.reservationId}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <CalendarClock className="h-4 w-4 text-[var(--ops-warning)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{r.clientName}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.category.name} · {r.quantity} pacas
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusPill status="pending" size="sm" label={r.expirationDate ?? ""} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
