export const dynamic = "force-dynamic";

import { getAccountsReceivable } from "@/modules/sales/queries/invoice-queries";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const BUCKET_COLORS: Record<string, string> = {
  current: "bg-gray-100 text-gray-800",
  "0-30": "bg-yellow-100 text-yellow-800",
  "31-60": "bg-orange-100 text-orange-800",
  "61-90": "bg-red-100 text-red-800",
  "90+": "bg-red-200 text-red-900",
};

export default async function AccountsReceivablePage() {
  const invoices = await getAccountsReceivable();

  const totals = invoices.reduce(
    (acc, i) => {
      acc[i.bucket] = (acc[i.bucket] ?? 0) + i.balance;
      acc.total += i.balance;
      return acc;
    },
    { total: 0 } as Record<string, number>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cuentas por cobrar</h1>
        <p className="text-muted-foreground mt-1">
          Facturas pendientes y parciales, con antiguedad
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="bg-gray-50 border rounded p-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-semibold">${(totals.total ?? 0).toFixed(2)}</p>
        </div>
        {(["current", "0-30", "31-60", "61-90", "90+"] as const).map((b) => (
          <div key={b} className="bg-card border rounded p-3">
            <p className="text-xs text-muted-foreground capitalize">{b === "current" ? "Al dia" : b}</p>
            <p className="text-lg font-semibold">${(totals[b] ?? 0).toFixed(2)}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Factura</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Emitida</th>
              <th className="px-3 py-2">Vence</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Pagado</th>
              <th className="px-3 py-2 text-right">Pendiente</th>
              <th className="px-3 py-2">Dias</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.invoiceId} className="border-t">
                <td className="px-3 py-2">
                  <Link href={`/invoices/${i.invoiceId}`} className="hover:underline">
                    {i.folio}
                  </Link>
                </td>
                <td className="px-3 py-2">{i.customer.name}</td>
                <td className="px-3 py-2">{new Date(i.issueDate).toLocaleDateString("es-ES")}</td>
                <td className="px-3 py-2">{i.dueDate ? new Date(i.dueDate).toLocaleDateString("es-ES") : "-"}</td>
                <td className="px-3 py-2 text-right tabular-nums">${String(i.total)}</td>
                <td className="px-3 py-2 text-right tabular-nums">${String(i.paid)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">${i.balance.toFixed(2)}</td>
                <td className="px-3 py-2">
                  <Badge className={BUCKET_COLORS[i.bucket]}>
                    {i.bucket === "current" ? "Al dia" : i.bucket}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
