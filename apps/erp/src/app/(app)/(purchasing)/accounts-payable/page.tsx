export const dynamic = "force-dynamic";

import {
  getSupplierBills,
  getAccountsPayableSummary,
  getReceivedPurchaseOrdersWithoutBill,
} from "@/modules/purchasing/queries/supplier-bill-queries";
import { getActiveSuppliersForPicker } from "@/modules/suppliers/queries/supplier-queries";
import { getActiveCurrencies } from "@/modules/envios/queries/currency-queries";
import { getBaseCurrency } from "@/lib/currency";
import { AccountsPayableClient } from "@/modules/purchasing/components/accounts-payable-client";
import { db } from "@/lib/db";

export default async function AccountsPayablePage() {
  const [bills, summary, receivablePOs, suppliers, currencies, baseCurrency] = await Promise.all([
    getSupplierBills(),
    getAccountsPayableSummary(),
    getReceivedPurchaseOrdersWithoutBill(),
    getActiveSuppliersForPicker(),
    getActiveCurrencies(),
    getBaseCurrency(db),
  ]);

  // Tasa vigente de cada moneda activa hacia la base, para el equivalente en
  // vivo del formulario. El server SIEMPRE recalcula al enviar.
  const rates = await db.exchangeRate.findMany({
    where: {
      OR: [{ quoteCurrencyId: baseCurrency.currencyId }, { baseCurrencyId: baseCurrency.currencyId }],
    },
  });
  const rateByCurrencyId = new Map<number, number>();
  for (const r of rates) {
    if (r.quoteCurrencyId === baseCurrency.currencyId) {
      rateByCurrencyId.set(r.baseCurrencyId, r.rate.toNumber());
    } else if (r.baseCurrencyId === baseCurrency.currencyId) {
      rateByCurrencyId.set(r.quoteCurrencyId, 1 / r.rate.toNumber());
    }
  }
  const currenciesForClient = currencies.map((c) => ({
    currencyId: c.currencyId,
    code: c.code,
    rateToBase: c.currencyId === baseCurrency.currencyId ? 1 : rateByCurrencyId.get(c.currencyId) ?? null,
  }));

  return (
    <AccountsPayableClient
      bills={bills}
      suppliers={suppliers}
      receivablePOs={receivablePOs}
      summary={summary}
      currencies={currenciesForClient}
      baseCurrencyId={baseCurrency.currencyId}
      baseCurrencyCode={baseCurrency.code}
    />
  );
}
