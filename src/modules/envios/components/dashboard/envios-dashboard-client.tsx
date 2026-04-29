"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { MetricTile } from "@/components/ui/metric-tile";
import {
  HandCoins, Clock, Check, ArrowRightLeft, Users, Wallet,
  CircleDollarSign, ArrowDownLeft, ArrowUpRight, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { confirmOperation } from "../../actions/operation-actions";
import type { DashboardData } from "../../queries/dashboard-queries";
import { CurrencyChip } from "../shared/currency-chip";
import { AmountDisplay } from "../shared/amount-display";
import { OpTypeBadge } from "../shared/op-type-badge";
import { OpStatusPill } from "../shared/op-status-pill";

const ACCENTS: Array<"brand" | "success" | "warning" | "info" | "danger" | "slate"> = [
  "info", "success", "danger", "brand", "warning", "slate",
];

interface Props {
  data: DashboardData;
}

export function EnviosDashboardClient({ data }: Props) {
  const router = useRouter();

  const handleConfirm = async (id: number) => {
    const r = await confirmOperation(id);
    if (r.success) { toast.success("Confirmada"); router.refresh(); }
    else toast.error(r.error);
  };

  const totalActiveCurrencies = data.balanceByCurrency.length;
  const generated = data.generatedAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-5">
      <PageHeader
        icon={HandCoins}
        title="Tesorería · Envíos"
        description={`SALDO GENERAL por moneda y movimientos recientes · actualizado ${generated}`}
        badge={`${totalActiveCurrencies} monedas activas`}
        actions={
          <>
            {data.pendingCount > 0 ? (
              <Button variant="outline" asChild>
                <Link href="/envios/pendientes">
                  <Clock className="h-4 w-4" /> Pendientes ({data.pendingCount})
                </Link>
              </Button>
            ) : null}
            <Button variant="brand" asChild>
              <Link href="/envios/operaciones">
                <Plus className="h-4 w-4" /> Nueva operación
              </Link>
            </Button>
          </>
        }
      />

      {/* SALDO GENERAL por moneda — KPIs grandes */}
      {data.balanceByCurrency.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
          <CircleDollarSign className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            No hay monedas activas todavía. <Link href="/envios/monedas" className="text-[var(--brand)] underline">Configura las monedas</Link> para empezar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {data.balanceByCurrency.map((b, i) => (
            <KpiCard
              key={b.currencyId}
              label={`SALDO GENERAL · ${b.code}`}
              value={b.total.toLocaleString("es-MX", {
                minimumFractionDigits: b.decimalPlaces,
                maximumFractionDigits: b.decimalPlaces,
              })}
              icon={CircleDollarSign}
              accent={ACCENTS[i % ACCENTS.length]}
            />
          ))}
        </div>
      )}

      {/* Métricas operativas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MetricTile
          label="Pendientes"
          value={data.pendingCount}
          icon={Clock}
          tone={data.pendingCount > 0 ? "warning" : "idle"}
        />
        <MetricTile
          label="Operaciones hoy"
          value={data.todayOpsCount}
          icon={Check}
          tone="active"
        />
        <MetricTile
          label="Grupos activos"
          value={data.activeGroupsCount}
          icon={Users}
          tone="track"
        />
        <MetricTile
          label="Cuentas activas"
          value={data.totalAccountsCount}
          icon={Wallet}
          tone="success"
        />
      </div>

      {/* Split: Pendientes + Movimientos recientes */}
      <div className="grid lg:grid-cols-3 gap-4">
        <PendingPanel
          pending={data.pendingTop}
          totalPending={data.pendingCount}
          onConfirm={handleConfirm}
        />
        <RecentActivityPanel recent={data.recentOps} />
      </div>

      {/* Flow chart por moneda */}
      {data.flowSeries.length > 0 ? (
        <FlowSection flow={data.flowSeries} />
      ) : null}
    </div>
  );
}

function PendingPanel({
  pending,
  totalPending,
  onConfirm,
}: {
  pending: DashboardData["pendingTop"];
  totalPending: number;
  onConfirm: (id: number) => void;
}) {
  return (
    <div className="lg:col-span-1 flex flex-col rounded-xl border border-border bg-card p-4 shadow-panel gap-3 min-h-0 max-h-[420px] lg:max-h-[460px]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-headline text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-[var(--ops-warning)]" />
          Pendientes
        </h2>
        {totalPending > 0 ? (
          <Link href="/envios/pendientes" className="text-xs text-[var(--brand)] hover:underline">
            Ver todas ({totalPending}) →
          </Link>
        ) : null}
      </div>
      {pending.length === 0 ? (
        <div className="rounded-md bg-muted/30 px-3 py-6 text-center">
          <Check className="mx-auto h-6 w-6 text-[var(--ops-success)]" />
          <p className="mt-1.5 text-xs text-muted-foreground">Todo confirmado.</p>
        </div>
      ) : (
        <ul className="space-y-1.5 overflow-y-auto pr-1 -mr-1 flex-1 min-h-0">
          {pending.map((o) => {
            const sign = o.type === "withdrawal" || o.type === "transfer_out"
              ? -o.amount
              : o.type === "deposit" || o.type === "transfer_in"
                ? +o.amount
                : o.amount;
            return (
              <li
                key={o.operationId}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2.5 py-1.5 ring-1 ring-inset ring-[var(--ops-warning)]/20"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-medium truncate flex items-center gap-1.5">
                    <OpTypeBadge type={o.type} />
                    {o.accountName}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {o.groupName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="flex items-center gap-1 text-xs">
                    <AmountDisplay value={sign} decimalPlaces={o.currencyDecimals} showSign signed size="sm" />
                    <CurrencyChip code={o.currencyCode} size="sm" />
                  </span>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => onConfirm(o.operationId)} aria-label="Confirmar">
                    <Check className="h-3.5 w-3.5 text-[var(--ops-success)]" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RecentActivityPanel({ recent }: { recent: DashboardData["recentOps"] }) {
  return (
    <div className="lg:col-span-2 hidden lg:flex flex-col rounded-xl border border-border bg-card p-4 shadow-panel gap-3 min-h-0 lg:max-h-[460px]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-headline text-sm font-semibold flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-[var(--ops-active)]" />
          Movimientos recientes
        </h2>
        <Link href="/envios/operaciones" className="text-xs text-[var(--brand)] hover:underline">
          Ver historial →
        </Link>
      </div>
      {recent.length === 0 ? (
        <div className="rounded-md bg-muted/30 px-3 py-6 text-center">
          <ArrowRightLeft className="mx-auto h-6 w-6 text-muted-foreground/50" />
          <p className="mt-1.5 text-xs text-muted-foreground">Aún sin movimientos confirmados.</p>
        </div>
      ) : (
        <ul className="space-y-1.5 overflow-y-auto pr-1 -mr-1 flex-1 min-h-0">
          {recent.map((o) => {
            const sign = o.type === "withdrawal" || o.type === "transfer_out"
              ? -o.amount
              : o.type === "deposit" || o.type === "transfer_in"
                ? +o.amount
                : o.amount;
            return (
              <li
                key={o.operationId}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/20 px-2.5 py-1.5"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <OpTypeBadge type={o.type} />
                    <OpStatusPill status={o.status} />
                    <span className="text-xs font-medium truncate">{o.accountName}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {o.groupName} · {new Date(o.occurredAt).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {o.description ? ` · ${o.description}` : ""}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-xs shrink-0">
                  <AmountDisplay value={sign} decimalPlaces={o.currencyDecimals} showSign signed size="sm" />
                  <CurrencyChip code={o.currencyCode} size="sm" />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FlowSection({ flow }: { flow: DashboardData["flowSeries"] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-panel space-y-3">
      <h2 className="font-headline text-sm font-semibold flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-[var(--ops-active)]" />
        Flujo de los últimos 30 días
      </h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {flow.map((f) => {
          const total = f.inflow + f.outflow;
          const inflowPct = total > 0 ? (f.inflow / total) * 100 : 0;
          return (
            <div key={f.code} className="rounded-md bg-muted/20 p-3 ring-1 ring-inset ring-border space-y-2">
              <div className="flex items-center justify-between">
                <CurrencyChip code={f.code} size="md" />
                <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                  total {total.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-muted flex">
                <div
                  className="bg-[var(--ops-success)]"
                  style={{ width: `${inflowPct}%` }}
                  aria-label={`Entradas ${inflowPct.toFixed(1)}%`}
                />
                <div
                  className="bg-rose-500"
                  style={{ width: `${100 - inflowPct}%` }}
                  aria-label={`Salidas ${(100 - inflowPct).toFixed(1)}%`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-[var(--ops-success)] font-mono tabular-nums">
                  <ArrowDownLeft className="h-3 w-3" />
                  {f.inflow.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                </span>
                <span className="flex items-center gap-1 text-rose-600 font-mono tabular-nums">
                  <ArrowUpRight className="h-3 w-3" />
                  {f.outflow.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
