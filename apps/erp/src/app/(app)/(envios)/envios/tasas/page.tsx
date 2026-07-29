export const dynamic = "force-dynamic";

import { ExchangeRateListClient } from "@/modules/envios/components/exchange-rates/exchange-rate-list-client";
import {
  getExchangeRateRules,
  getRateRuleFormData,
} from "@/modules/envios/queries/exchange-rate-queries";

export default async function TasasPage() {
  const [rules, currencies] = await Promise.all([
    getExchangeRateRules(),
    getRateRuleFormData(),
  ]);
  return (
    <div className="p-4 md:p-6">
      <ExchangeRateListClient initialRules={rules} currencies={currencies} />
    </div>
  );
}
