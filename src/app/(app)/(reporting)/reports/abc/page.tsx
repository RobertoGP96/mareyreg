export const dynamic = "force-dynamic";

import { getAbcAnalysis } from "@/modules/reporting/queries/abc-queries";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analisis ABC</h1>
        <p className="text-muted-foreground mt-1">
          Clasificacion por contribucion a ingresos en los ultimos 90 dias
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-xs font-medium text-green-800">Clase A (80%)</p>
          <p className="text-2xl font-bold text-green-900">{counts.A}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-medium text-blue-800">Clase B (15%)</p>
          <p className="text-2xl font-bold text-blue-900">{counts.B}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-800">Clase C (5%)</p>
          <p className="text-2xl font-bold text-gray-900">{counts.C}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Sin ventas en el periodo"
          description="Aun no hay facturas para analizar."
        />
      ) : (
        <div className="bg-card border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
                <th className="px-3 py-2 text-right">Ingresos</th>
                <th className="px-3 py-2 text-right">Acumulado</th>
                <th className="px-3 py-2 text-right">%</th>
                <th className="px-3 py-2">Clase</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.productId} className="border-t">
                  <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.qty.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${r.revenue.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${r.cumulativeRevenue.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.cumulativePct.toFixed(1)}%</td>
                  <td className="px-3 py-2">
                    <Badge
                      className={
                        r.abcClass === "A"
                          ? "bg-green-100 text-green-800"
                          : r.abcClass === "B"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {r.abcClass}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
