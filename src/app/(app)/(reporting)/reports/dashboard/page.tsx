export const dynamic = "force-dynamic";

import {
  getInventoryValueSummary,
  getSalesSummary,
  getLowStockAlerts,
  getOverdueInvoices,
  getSalesLast30Days,
} from "@/modules/reporting/queries/dashboard-queries";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { MetricTile } from "@/components/ui/metric-tile";
import { Spark } from "@/components/ui/spark";
import { StatusPill } from "@/components/ui/status-pill";
import {
  BarChart3,
  Package,
  ShoppingCart,
  AlertTriangle,
  Clock,
  Boxes,
  TrendingUp,
  Receipt,
  CircleDollarSign,
  PackageOpen,
} from "lucide-react";

function formatCurrency(n: number) {
  return `$${n.toFixed(0)}`;
}

export default async function ReportsDashboardPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const last30 = new Date();
  last30.setDate(last30.getDate() - 30);

  const [invValue, salesMonth, sales30, lowStock, overdue, series] = await Promise.all([
    getInventoryValueSummary(),
    getSalesSummary(startOfMonth, now),
    getSalesSummary(last30, now),
    getLowStockAlerts(),
    getOverdueInvoices(),
    getSalesLast30Days(),
  ]);

  // Build 30-day spark from series
  const spark30: number[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const found = series.find((x) => x.day === key);
    spark30.push(found ? found.total : 0);
  }
  const spark14 = spark30.slice(-14);

  const totalInventoryValue = invValue.inventoryValue + invValue.pacasValue;
  const overdueBalance = overdue.reduce(
    (acc, i) => acc + (Number(i.total) - Number(i.paid)),
    0
  );

  return (
    <div className="space-y-5">
      <PageHeader
        icon={BarChart3}
        title="Cockpit de reportes"
        description="Resumen consolidado de inventario, ventas y alertas operativas."
        badge="Vista ejecutiva"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Ventas (30d)"
          value={formatCurrency(sales30.combinedTotal)}
          icon={TrendingUp}
          spark={spark14}
          accent="brand"
        />
        <KpiCard
          label="Valor inventario"
          value={formatCurrency(totalInventoryValue)}
          icon={CircleDollarSign}
          accent="info"
        />
        <KpiCard
          label="Stock bajo"
          value={lowStock.length}
          icon={AlertTriangle}
          accent={lowStock.length > 0 ? "warning" : "slate"}
        />
        <KpiCard
          label="Facturas vencidas"
          value={overdue.length}
          icon={Clock}
          accent={overdue.length > 0 ? "danger" : "slate"}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricTile
          label="Ventas del mes"
          value={formatCurrency(salesMonth.combinedTotal)}
          icon={ShoppingCart}
          tone="active"
          hint={`${salesMonth.invoiceCount} facturas · ${salesMonth.pacasCount} pacas`}
        />
        <MetricTile
          label="Inventario gral."
          value={formatCurrency(invValue.inventoryValue)}
          icon={Package}
          tone="track"
          hint={`${invValue.inventoryQty.toFixed(0)} unidades`}
        />
        <MetricTile
          label="Pacas"
          value={formatCurrency(invValue.pacasValue)}
          icon={Boxes}
          tone="success"
          hint={`${invValue.pacasQty} unidades`}
        />
        <MetricTile
          label="Saldo vencido"
          value={formatCurrency(overdueBalance)}
          icon={Receipt}
          tone={overdueBalance > 0 ? "critical" : "idle"}
        />
      </div>

      {/* Sales trend */}
      <div className="cockpit-panel p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--ops-active)]" />
            Tendencia de ventas (30 días)
          </h2>
          <Badge variant="brand">{formatCurrency(sales30.combinedTotal)}</Badge>
        </div>
        {spark30.every((v) => v === 0) ? (
          <p className="text-sm text-muted-foreground">Sin ventas en el periodo.</p>
        ) : (
          <div className="rounded-lg bg-muted/30 p-3">
            <Spark data={spark30} color="#2563eb" height={120} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low stock alerts */}
        <div className="cockpit-panel p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--ops-warning)]" />
              Alertas de stock bajo
            </h2>
            <Badge variant="warning">{lowStock.length}</Badge>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin alertas.</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {lowStock.slice(0, 12).map((l) => {
                const qty = Number(l.currentQuantity);
                const min = Number(l.product.minStock);
                const isOut = qty <= 0;
                return (
                  <li
                    key={`${l.productId}-${l.warehouseId}`}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="grid size-8 place-items-center rounded-md bg-[var(--ops-warning)]/12 text-[var(--ops-warning)] shrink-0">
                      <PackageOpen className="size-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {l.product.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {l.warehouse.name} · min {min} {l.product.unit}
                      </div>
                    </div>
                    <span
                      className={`font-mono tabular-nums text-sm font-semibold shrink-0 ${
                        isOut
                          ? "text-[var(--ops-critical)]"
                          : "text-[var(--ops-warning)]"
                      }`}
                    >
                      {qty}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Overdue invoices */}
        <div className="cockpit-panel p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--ops-critical)]" />
              Facturas vencidas
            </h2>
            <Badge variant="destructive">{overdue.length}</Badge>
          </div>
          {overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin vencidas.</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {overdue.slice(0, 12).map((i) => {
                const balance = Number(i.total) - Number(i.paid);
                return (
                  <li
                    key={i.invoiceId}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="grid size-8 place-items-center rounded-md bg-[var(--ops-critical)]/10 text-[var(--ops-critical)] shrink-0">
                      <Receipt className="size-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {i.folio}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {i.customer.name}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {i.dueDate
                          ? `Vence: ${new Date(i.dueDate).toLocaleDateString("es-ES")}`
                          : "Sin fecha de vencimiento"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <StatusPill
                        status={i.status === "partial" ? "in_progress" : "pending"}
                        size="sm"
                      />
                      <span className="font-mono tabular-nums text-xs font-semibold text-[var(--ops-critical)]">
                        ${balance.toFixed(2)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
