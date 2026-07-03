import { db } from "@/lib/db";
import { getBaseCurrency } from "@/lib/currency";

export interface CashCurrencyBreakdownRow {
  currencyId: number | null;
  currencyCode: string;
  symbol: string;
  decimalPlaces: number;
  /** Suma de lo entregado en esta moneda (amountTendered, o amount si es la moneda base). */
  totalTendered: number;
  /** Suma de lo aplicado a las facturas, siempre en moneda base (CUP). */
  totalAppliedBase: number;
  paymentsCount: number;
}

/**
 * Desglose por moneda de los pagos de una sesión de caja (POS). `CashSession`
 * se relaciona con sus ventas vía `Invoice.sessionId` (no por rango de tiempo
 * ni warehouse), así que basta un solo `findMany` de pagos con esa condición.
 *
 * La moneda base (CUP, currencyId null en InvoicePayment) SIEMPRE aparece en
 * el resultado, incluso con 0 pagos, para que la UI tenga una fila de
 * referencia estable. El resto de las monedas solo aparecen si tuvieron
 * pagos en la sesión.
 */
export async function getCashSessionCurrencyBreakdown(
  sessionId: number
): Promise<CashCurrencyBreakdownRow[]> {
  const base = await getBaseCurrency(db);

  const payments = await db.invoicePayment.findMany({
    where: { invoice: { sessionId } },
    select: {
      amount: true,
      currencyId: true,
      amountTendered: true,
      currency: { select: { code: true, symbol: true, decimalPlaces: true } },
    },
  });

  const byCurrency = new Map<
    number | null,
    { code: string; symbol: string; decimalPlaces: number; totalTendered: number; totalAppliedBase: number; paymentsCount: number }
  >();

  byCurrency.set(null, {
    code: base.code,
    symbol: base.symbol,
    decimalPlaces: base.decimalPlaces,
    totalTendered: 0,
    totalAppliedBase: 0,
    paymentsCount: 0,
  });

  for (const p of payments) {
    const key = p.currencyId;
    const appliedBase = Number(p.amount);
    // amountTendered es null cuando se pagó en moneda base — en ese caso lo
    // entregado y lo aplicado a la factura son el mismo monto.
    const tendered = p.amountTendered != null ? Number(p.amountTendered) : appliedBase;

    const existing = byCurrency.get(key);
    if (existing) {
      existing.totalTendered += tendered;
      existing.totalAppliedBase += appliedBase;
      existing.paymentsCount += 1;
    } else {
      byCurrency.set(key, {
        code: p.currency?.code ?? `#${key}`,
        symbol: p.currency?.symbol ?? "",
        decimalPlaces: p.currency?.decimalPlaces ?? 2,
        totalTendered: tendered,
        totalAppliedBase: appliedBase,
        paymentsCount: 1,
      });
    }
  }

  return Array.from(byCurrency.entries())
    .map(([currencyId, v]) => ({
      currencyId,
      currencyCode: v.code,
      symbol: v.symbol,
      decimalPlaces: v.decimalPlaces,
      totalTendered: v.totalTendered,
      totalAppliedBase: v.totalAppliedBase,
      paymentsCount: v.paymentsCount,
    }))
    .sort((a, b) => {
      if (a.currencyId === null) return -1;
      if (b.currencyId === null) return 1;
      return a.currencyCode.localeCompare(b.currencyCode);
    });
}
