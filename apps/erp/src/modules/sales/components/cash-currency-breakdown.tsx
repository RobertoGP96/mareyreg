import { CircleDollarSign } from "lucide-react";
import { formatAmount } from "@/lib/format";
import type { CashCurrencyBreakdownRow } from "../queries/cash-currency-queries";

interface Props {
  rows: CashCurrencyBreakdownRow[];
  baseCurrencyCode: string;
}

/**
 * Tarjeta compacta con el desglose de pagos de una sesión de caja por
 * moneda: cuánto se entregó en cada moneda y su equivalente aplicado en CUP.
 * Server component puro — recibe filas ya serializadas (Decimal → number)
 * desde `getCashSessionCurrencyBreakdown`, sin lógica de conversión propia.
 */
export function CashCurrencyBreakdown({ rows, baseCurrencyCode }: Props) {
  const totalBase = rows.reduce((sum, r) => sum + r.totalAppliedBase, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-panel">
      <div className="flex items-center gap-2">
        <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-headline text-sm font-semibold text-foreground">Desglose por moneda</h3>
      </div>

      <div className="divide-y divide-border/60">
        {rows.map((row) => (
          <div key={row.currencyId ?? "base"} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">{row.currencyCode}</div>
              <div className="text-xs text-muted-foreground">
                {row.paymentsCount} pago{row.paymentsCount === 1 ? "" : "s"}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono tabular-nums text-sm text-foreground">
                {formatAmount(row.totalTendered, row.decimalPlaces)} {row.currencyCode}
              </div>
              {row.currencyId !== null && (
                <div className="font-mono tabular-nums text-xs text-muted-foreground">
                  ≈ {formatAmount(row.totalAppliedBase, 0)} {baseCurrencyCode}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2.5">
        <span className="text-sm font-medium text-foreground">Total general</span>
        <span className="font-mono tabular-nums text-base font-semibold text-foreground">
          {formatAmount(totalBase, 0)} {baseCurrencyCode}
        </span>
      </div>
    </div>
  );
}
