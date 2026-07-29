export const dynamic = "force-dynamic";

import { getCurrentRates, getRateHistory, getRateFormData } from "@/modules/currency/queries/rate-queries";
import { RateManagerClient } from "@/modules/currency/components/rate-manager-client";
import type { ExchangeRateHistoryRow } from "@/modules/currency/lib/types";

export default async function CurrencyTasasPage() {
  const [rates, { currencies }] = await Promise.all([getCurrentRates(), getRateFormData()]);

  const historyEntries = await Promise.all(
    rates.map(async (r) => [r.exchangeRateId, await getRateHistory(r.exchangeRateId)] as const)
  );
  const historyByRateId = historyEntries.reduce<Record<number, ExchangeRateHistoryRow[]>>(
    (acc, [id, history]) => {
      acc[id] = history;
      return acc;
    },
    {}
  );

  return (
    <div className="p-4 md:p-6">
      <RateManagerClient rates={rates} historyByRateId={historyByRateId} currencies={currencies} />
    </div>
  );
}
