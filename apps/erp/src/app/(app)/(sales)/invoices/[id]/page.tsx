export const dynamic = "force-dynamic";

import { getInvoice } from "@/modules/sales/queries/invoice-queries";
import { getPaymentCurrencyOptions } from "@/modules/sales/queries/payment-currency-queries";
import { AccountsReceivableRowActions } from "@/modules/sales/components/accounts-receivable-row-actions";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  partial: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit: "Credito",
  other: "Otro",
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [invoice, paymentCurrencies] = await Promise.all([
    getInvoice(Number(id)),
    getPaymentCurrencyOptions(),
  ]);
  if (!invoice) notFound();

  const total = Number(invoice.total);
  const paid = Number(invoice.paid);
  const balance = Math.max(total - paid, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Factura {invoice.folio}</h1>
          <div className="text-muted-foreground mt-1 flex gap-3 flex-wrap items-center">
            <Badge className={STATUS_COLORS[invoice.status]}>{invoice.status}</Badge>
            <Badge variant="outline">{invoice.channel.toUpperCase()}</Badge>
            <span>Cliente: {invoice.customer.name}</span>
            <span>Fecha: {new Date(invoice.issueDate).toLocaleDateString("es-ES")}</span>
            {invoice.dueDate && <span>Vence: {new Date(invoice.dueDate).toLocaleDateString("es-ES")}</span>}
          </div>
        </div>
        {balance > 0 && invoice.status !== "cancelled" && (
          <AccountsReceivableRowActions
            target={{
              invoiceId: invoice.invoiceId,
              folio: invoice.folio,
              customerName: invoice.customer.name,
              balance,
            }}
            currencies={paymentCurrencies.currencies}
            baseCurrencyId={paymentCurrencies.baseCurrencyId}
            baseCurrencyCode={paymentCurrencies.baseCurrencyCode}
          />
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-card border rounded p-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-semibold font-mono tabular-nums">
            {total.toFixed(0)} {paymentCurrencies.baseCurrencyCode}
          </p>
        </div>
        <div className="bg-card border rounded p-3">
          <p className="text-xs text-muted-foreground">Pagado</p>
          <p className="text-lg font-semibold font-mono tabular-nums">
            {paid.toFixed(0)} {paymentCurrencies.baseCurrencyCode}
          </p>
        </div>
        <div className="bg-card border rounded p-3">
          <p className="text-xs text-muted-foreground">Pendiente</p>
          <p className="text-lg font-semibold font-mono tabular-nums">
            {balance.toFixed(0)} {paymentCurrencies.baseCurrencyCode}
          </p>
        </div>
      </div>

      <div className="bg-card border rounded-lg">
        <div className="px-4 py-3 border-b">
          <h2 className="font-medium">Lineas</h2>
        </div>
        <div className="p-4 grid gap-2">
          {invoice.lines.map((l) => {
            // Línea catch-weight (pieces != null): el precio es por kg y
            // baseQuantity es el peso real — se muestra solo en kg, sin el
            // desglose por presentación/piezas.
            const isCatchWeightLine = l.pieces != null;
            return (
              <div key={l.lineId} className="flex justify-between items-start gap-2 text-sm border-b last:border-0 pb-2 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium">{l.product.name}</p>
                  {!isCatchWeightLine && l.presentation && (
                    <p className="text-xs text-muted-foreground">{l.presentation.name}</p>
                  )}
                </div>
                <div className="text-right font-mono tabular-nums shrink-0">
                  <p>
                    {isCatchWeightLine
                      ? `${Number(Number(l.baseQuantity).toFixed(3))} kg × ${Number(l.unitPrice).toFixed(2)}/kg`
                      : `${String(l.quantity)} × ${Number(l.unitPrice).toFixed(2)}`}
                  </p>
                  <p className="font-medium">{Number(l.subtotal).toFixed(2)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card border rounded-lg">
        <div className="px-4 py-3 border-b">
          <h2 className="font-medium">Pagos</h2>
        </div>
        <div className="p-4 grid gap-2">
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
          ) : (
            invoice.payments.map((p) => {
              const methodLabel = PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod;
              const isForeign = p.currencyId != null && p.currency != null;
              return (
                <div key={p.paymentId} className="flex justify-between items-start gap-2 text-sm border-b last:border-0 pb-2 last:pb-0">
                  <div>
                    <p className="font-medium">{methodLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.paidAt).toLocaleDateString("es-ES")}
                      {p.reference && ` · ${p.reference}`}
                    </p>
                    {isForeign && p.amountTendered != null && (
                      <p className="text-xs text-muted-foreground">
                        {Number(p.amountTendered).toFixed(2)} {p.currency!.code}
                        {p.exchangeRate != null && ` · tasa ${Number(p.exchangeRate).toFixed(2)}`}
                      </p>
                    )}
                  </div>
                  <div className="text-right font-mono tabular-nums font-medium shrink-0">
                    {Number(p.amount).toFixed(0)} {paymentCurrencies.baseCurrencyCode}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
