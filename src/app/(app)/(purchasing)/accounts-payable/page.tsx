export const dynamic = "force-dynamic";

import { getAccountsPayable } from "@/modules/purchasing/queries/purchase-queries";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function AccountsPayablePage() {
  const orders = await getAccountsPayable();

  const total = orders.reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cuentas por pagar</h1>
        <p className="text-muted-foreground mt-1">
          OCs recibidas pendientes de conciliar con pagos al proveedor
        </p>
      </div>

      <div className="bg-card border rounded p-3 inline-block">
        <p className="text-xs text-muted-foreground">Total adeudado</p>
        <p className="text-2xl font-semibold">${total.toFixed(2)}</p>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">OC</th>
              <th className="px-3 py-2">Proveedor</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.poId} className="border-t">
                <td className="px-3 py-2">
                  <Link href={`/purchase-orders/${o.poId}`} className="hover:underline">
                    {o.folio}
                  </Link>
                </td>
                <td className="px-3 py-2">{o.supplier.name}</td>
                <td className="px-3 py-2">{new Date(o.orderDate).toLocaleDateString("es-ES")}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline">{o.status}</Badge>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">${String(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
