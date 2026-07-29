export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { CashDeliveryListClient } from "@/modules/envios/components/deliveries/cash-delivery-list-client";
import { listCashDeliveries } from "@/modules/envios/queries/cash-delivery-queries";
import { searchRecipientsForPicker } from "@/modules/envios/queries/recipient-queries";
import { getCurrencies } from "@/modules/envios/queries/currency-queries";
import { getCourierPickerOptions } from "@/modules/envios/queries/courier-queries";
import { getActiveDenominationsByCurrency } from "@/modules/envios/queries/currency-denomination-queries";

export default async function EntregasPage() {
  const [deliveries, recipients, currencies, couriers, denominationsByCurrency, session] =
    await Promise.all([
      listCashDeliveries(),
      searchRecipientsForPicker(""),
      getCurrencies(),
      getCourierPickerOptions(),
      getActiveDenominationsByCurrency(),
      auth(),
    ]);

  return (
    <div className="p-4 md:p-6">
      <CashDeliveryListClient
        initialDeliveries={deliveries}
        recipients={recipients}
        couriers={couriers}
        currencies={currencies}
        denominationsByCurrency={denominationsByCurrency}
        isAdmin={session?.user?.role === "admin"}
      />
    </div>
  );
}
