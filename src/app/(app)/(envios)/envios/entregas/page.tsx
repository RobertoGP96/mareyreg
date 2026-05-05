export const dynamic = "force-dynamic";

import { CashDeliveryListClient } from "@/modules/envios/components/deliveries/cash-delivery-list-client";
import { listCashDeliveries } from "@/modules/envios/queries/cash-delivery-queries";
import { searchRecipientsForPicker } from "@/modules/envios/queries/recipient-queries";
import { getCurrencies } from "@/modules/envios/queries/currency-queries";

export default async function EntregasPage() {
  const [deliveries, recipients, currencies] = await Promise.all([
    listCashDeliveries(),
    searchRecipientsForPicker(""),
    getCurrencies(),
  ]);
  return (
    <div className="p-4 md:p-6">
      <CashDeliveryListClient
        initialDeliveries={deliveries}
        recipients={recipients}
        currencies={currencies}
      />
    </div>
  );
}
