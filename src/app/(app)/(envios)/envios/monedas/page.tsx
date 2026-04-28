import { CurrencyListClient } from "@/modules/envios/components/currencies/currency-list-client";
import { getCurrencies } from "@/modules/envios/queries/currency-queries";

export default async function MonedasPage() {
  const currencies = await getCurrencies();
  return (
    <div className="p-4 md:p-6">
      <CurrencyListClient initialCurrencies={currencies} />
    </div>
  );
}
