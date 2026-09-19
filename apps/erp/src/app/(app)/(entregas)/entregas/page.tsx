export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { CashDeliveryListClient } from "@/modules/entregas/components/deliveries/cash-delivery-list-client";
import {
  listCashDeliveries,
  getPendingCommissionByCurrency,
} from "@/modules/entregas/queries/cash-delivery-queries";
import { searchRecipientsForPicker } from "@/modules/entregas/queries/recipient-queries";
import { getCourierPickerOptions } from "@/modules/entregas/queries/courier-queries";
import {
  getCurrencyOptions,
  getActiveDenominationsByCurrency,
} from "@/modules/entregas/queries/catalog-queries";

export default async function EntregasPage() {
  const [
    deliveries,
    recipients,
    currencies,
    couriers,
    denominationsByCurrency,
    commissionByCurrency,
    session,
  ] = await Promise.all([
    listCashDeliveries(),
    searchRecipientsForPicker(""),
    getCurrencyOptions(),
    getCourierPickerOptions(),
    getActiveDenominationsByCurrency(),
    getPendingCommissionByCurrency(),
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
        commissionByCurrency={commissionByCurrency}
        isAdmin={session?.user?.role === "admin"}
      />
    </div>
  );
}
