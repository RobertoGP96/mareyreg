export const dynamic = "force-dynamic";

import {
  getInventoryValueSummary,
  getSalesSummary,
  getLowStockAlerts,
  getOverdueInvoices,
  getSalesLast30Days,
} from "@/modules/reporting/queries/dashboard-queries";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Package, ShoppingCart, TriangleAlert, Clock } from "lucide-react";

export default async function DashboardPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [invValue, salesMonth, lowStock, overdue, series] = await Promise.all([
    getInventoryValueSummary(),
    getSalesSummary(startOfMonth, now),
    getLowStockAlerts(),
    getOverdueInvoices(),
    getSalesLast30Days(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Resumen consolidado de inventario, ventas y alertas
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Package className="w-4 h-4" /> Valor de inventario
          </div>
          <p className="text-2xl font-semibold mt-1">
            ${(invValue.inventoryValue + invValue.pacasValue).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Inventario: ${invValue.inventoryValue.toFixed(2)} · Pacas: ${invValue.pacasValue.toFixed(2)}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <ShoppingCart className="w-4 h-4" /> Ventas del mes
          </div>
          <p className="text-2xl font-semibold mt-1">
            ${salesMonth.combinedTotal.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {salesMonth.invoiceCount} facturas · {salesMonth.pacasCount} pacas
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <TriangleAlert className="w-4 h-4" /> Stock bajo
          </div>
          <p className="text-2xl font-semibold mt-1">{lowStock.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Productos en/bajo el punto de reorden</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Clock className="w-4 h-4" /> Facturas vencidas
          </div>
          <p className="text-2xl font-semibold mt-1">{overdue.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Pendientes de cobro fuera de plazo</p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-medium mb-3">Ventas ultimos 30 dias</h2>
        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ventas en el periodo.</p>
        ) : (
          <div className="space-y-1">
            {series.map((d) => {
              const max = Math.max(...series.map((x) => x.total));
              const pct = max > 0 ? (d.total / max) * 100 : 0;
              return (
                <div key={d.day} className="flex items-center gap-2 text-xs">
                  <span className="w-24 tabular-nums text-muted-foreground">{d.day}</span>
                  <div className="flex-1 bg-muted rounded h-3 overflow-hidden">
                    <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-20 text-right tabular-nums">${d.total.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <h2 className="font-medium mb-3">Alertas de stock bajo</h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin alertas.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {lowStock.slice(0, 20).map((l) => (
                <div
                  key={`${l.productId}-${l.warehouseId}`}
                  className="flex justify-between text-sm border rounded px-2 py-1"
                >
                  <span className="truncate">{l.product.name}</span>
                  <span className="text-muted-foreground">
                    {String(l.currentQuantity)} / min {String(l.product.minStock)} {l.product.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-4">
          <h2 className="font-medium mb-3">Facturas vencidas</h2>
          {overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin vencidas.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {overdue.map((i) => {
                const balance = Number(i.total) - Number(i.paid);
                return (
                  <div
                    key={i.invoiceId}
                    className="flex justify-between text-sm border rounded px-2 py-1"
                  >
                    <span>
                      <span className="font-medium">{i.folio}</span>
                      <span className="text-muted-foreground"> · {i.customer.name}</span>
                    </span>
                    <span>
                      <Badge variant="outline" className="mr-2">{i.status}</Badge>
                      <span className="tabular-nums">${balance.toFixed(2)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
