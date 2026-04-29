"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { MetricTile } from "@/components/ui/metric-tile";
import { TimelineStrip } from "@/components/ui/timeline-strip";
import { Spark } from "@/components/ui/spark";
import {
  Activity,
  Route as RouteIcon,
  Truck,
  Users,
  CircleDollarSign,
  CalendarClock,
  TrendingUp,
  MapPin,
  Plus,
} from "lucide-react";
import type { LogisticsDashboardData } from "../queries/dashboard-queries";
import type { OpsStatus } from "@/components/ui/status-pill";

interface Props {
  data: LogisticsDashboardData;
}

export function LogisticsDashboardClient({ data }: Props) {
  const router = useRouter();
  const { counts, drivers, vehicles, payments, spark14, topProvinces, topDrivers, activeFeed } = data;
  const maxProv = Math.max(1, ...topProvinces.map((p) => p.count));

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Activity}
        title="Cockpit logístico"
        description="Estado en vivo de la operación: viajes activos, flota y pagos."
        badge="Últimos 30 días"
        actions={
          <>
            <Button variant="outline" onClick={() => router.push("/routes")}>
              <RouteIcon className="h-4 w-4" /> Rutas
            </Button>
            <Button variant="brand" onClick={() => router.push("/trips")}>
              <Plus className="h-4 w-4" /> Nuevo viaje
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Viajes (30d)"
          value={counts.total}
          icon={CalendarClock}
          spark={spark14}
          accent="brand"
        />
        <KpiCard
          label="En curso"
          value={counts.inProgress}
          icon={Activity}
          accent="warning"
        />
        <KpiCard
          label="Completados"
          value={counts.completed}
          icon={TrendingUp}
          accent="success"
        />
        <KpiCard
          label="Pagos pendientes"
          value={`$${payments.pending.toFixed(0)}`}
          icon={CircleDollarSign}
          accent="danger"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricTile label="Programados" value={counts.scheduled} icon={CalendarClock} tone="idle" />
        <MetricTile label="Cancelados"  value={counts.cancelled} icon={Activity} tone="critical" />
        <MetricTile label="Conductores" value={drivers} icon={Users} tone="active" />
        <MetricTile label="Vehículos"   value={vehicles} icon={Truck} tone="track" />
      </div>

      <div className="cockpit-panel p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-sm font-semibold text-foreground">
            Operación en vivo
          </h2>
          <Badge variant="outline">{activeFeed.length}</Badge>
        </div>
        <TimelineStrip
          events={activeFeed.map((e) => ({
            id: e.id,
            title: e.title,
            subtitle: e.subtitle,
            status: e.status as OpsStatus,
            time: e.time,
            onClick: () => router.push(`/trips/${e.id}`),
          }))}
          emptyLabel="No hay viajes recientes."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="cockpit-panel p-4 sm:p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[var(--ops-active)]" />
              Tendencia 14 días
            </h2>
            <Badge variant="brand">{spark14.reduce((a, n) => a + n, 0)} viajes</Badge>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <Spark data={spark14} color="#2563eb" height={96} />
          </div>
        </div>

        <div className="cockpit-panel p-4 sm:p-5 space-y-3">
          <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[var(--ops-track)]" />
            Top provincias
          </h2>
          {topProvinces.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          ) : (
            <ul className="space-y-2">
              {topProvinces.map((p) => (
                <li key={p.province} className="flex items-center gap-2">
                  <span className="text-sm text-foreground w-32 truncate">{p.province}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-[var(--ops-active)]"
                      style={{ width: `${(p.count / maxProv) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono tabular-nums text-xs text-muted-foreground w-6 text-right">
                    {p.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="cockpit-panel p-4 sm:p-5 space-y-3">
        <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--ops-active)]" />
          Conductores más activos
        </h2>
        {topDrivers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin actividad reciente.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {topDrivers.map((d, i) => (
              <li
                key={d.name}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
              >
                <span className="grid size-8 place-items-center rounded-md bg-[var(--ops-active)]/10 text-[var(--ops-active)] text-xs font-bold">
                  #{i + 1}
                </span>
                <span className="flex-1 font-medium text-sm text-foreground truncate">
                  {d.name}
                </span>
                <Badge variant="brand">{d.count}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
