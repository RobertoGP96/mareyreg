export const dynamic = "force-dynamic";

import { getAbcAnalysis } from "@/modules/reporting/queries/abc-queries";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { BarChart3, Trophy, Layers, Archive, CircleDollarSign } from "lucide-react";

const CLASS_BG: Record<"A" | "B" | "C", string> = {
  A: "bg-[var(--ops-success)]/12 text-[var(--ops-success)] ring-1 ring-inset ring-[var(--ops-success)]/30",
  B: "bg-[var(--ops-active)]/12 text-[var(--ops-active)] ring-1 ring-inset ring-[var(--ops-active)]/30",
  C: "bg-[var(--ops-idle)]/12 text-[var(--ops-idle)] ring-1 ring-inset ring-[var(--ops-idle)]/30",
};

export default async function AbcPage() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);

  const rows = await getAbcAnalysis(from, to);

  const counts = rows.reduce(
    (acc, r) => {
      acc[r.abcClass]++;
      return acc;
    },
    { A: 0, B: 0, C: 0 } as Record<"A" | "B" | "C", number>
  );

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const revenueByClass = rows.reduce(
    (acc, r) => {
      acc[r.abcClass] += r.revenue;
      return acc;
    },
    { A: 0, B: 0, C: 0 } as Record<"A" | "B" | "C", number>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        icon={BarChart3}
        title="Análisis ABC"
        description="Clasificación de productos por contribución a ingresos en los últimos 90 días."
        badge={`${rows.length} productos`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Ingresos totales (90d)"
          value={`$${totalRevenue.toFixed(0)}`}
          icon={CircleDollarSign}
          accent="brand"
        />
        <KpiCard
          label="Clase A (80%)"
          value={counts.A}
          icon={Trophy}
          accent="success"
        />
        <KpiCard
          label="Clase B (15%)"
          value={counts.B}
          icon={Layers}
          accent="info"
        />
        <KpiCard
          label="Clase C (5%)"
          value={counts.C}
          icon={Archive}
          accent="slate"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Sin ventas en el periodo"
          description="Aún no hay facturas para analizar en los últimos 90 días."
        />
      ) : (
        <>
          {/* Distribution bar */}
          <div className="cockpit-panel p-4 sm:p-5 space-y-3">
            <h2 className="font-headline text-sm font-semibold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-[var(--ops-active)]" />
              Distribución por clase
            </h2>
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
              <div
                className="bg-[var(--ops-success)]"
                style={{ width: `${(revenueByClass.A / totalRevenue) * 100}%` }}
                title={`A: $${revenueByClass.A.toFixed(0)}`}
              />
              <div
                className="bg-[var(--ops-active)]"
                style={{ width: `${(revenueByClass.B / totalRevenue) * 100}%` }}
                title={`B: $${revenueByClass.B.toFixed(0)}`}
              />
              <div
                className="bg-[var(--ops-idle)]"
                style={{ width: `${(revenueByClass.C / totalRevenue) * 100}%` }}
                title={`C: $${revenueByClass.C.toFixed(0)}`}
              />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                <span className="inline-block size-2 rounded-full bg-[var(--ops-success)] mr-1.5" />
                A · ${revenueByClass.A.toFixed(0)} (
                {((revenueByClass.A / totalRevenue) * 100).toFixed(1)}%)
              </span>
              <span>
                <span className="inline-block size-2 rounded-full bg-[var(--ops-active)] mr-1.5" />
                B · ${revenueByClass.B.toFixed(0)} (
                {((revenueByClass.B / totalRevenue) * 100).toFixed(1)}%)
              </span>
              <span>
                <span className="inline-block size-2 rounded-full bg-[var(--ops-idle)] mr-1.5" />
                C · ${revenueByClass.C.toFixed(0)} (
                {((revenueByClass.C / totalRevenue) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
              <h2 className="font-headline text-sm font-semibold text-foreground">
                Ranking por ingresos
              </h2>
              <Badge variant="outline">{rows.length}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">#</th>
                    <th className="px-3 py-2.5 font-medium">Producto</th>
                    <th className="px-3 py-2.5 font-medium text-right">
                      Cantidad
                    </th>
                    <th className="px-3 py-2.5 font-medium text-right">
                      Ingresos
                    </th>
                    <th className="px-3 py-2.5 font-medium text-right">
                      Acumulado
                    </th>
                    <th className="px-3 py-2.5 font-medium text-right">%</th>
                    <th className="px-3 py-2.5 font-medium">Clase</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.productId}
                      className="border-t border-border/60 hover:bg-[var(--brand)]/[0.03]"
                    >
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-foreground">
                        {r.name}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-mono text-foreground">
                        {r.qty.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-mono font-semibold text-foreground">
                        ${r.revenue.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-mono text-muted-foreground">
                        ${r.cumulativeRevenue.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-mono text-muted-foreground">
                        {r.cumulativePct.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold ${CLASS_BG[r.abcClass]}`}
                        >
                          {r.abcClass}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
