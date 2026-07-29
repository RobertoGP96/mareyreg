export const dynamic = "force-dynamic";

import { CourierListClient } from "@/modules/envios/components/couriers/courier-list-client";
import {
  listCouriers,
  getAssignableUsersForCourier,
} from "@/modules/envios/queries/courier-queries";
import { getDeliveryCommissionSummary } from "@/modules/envios/queries/cash-delivery-queries";
import { getCurrencies } from "@/modules/envios/queries/currency-queries";

export default async function MensajerosPage() {
  const [couriers, assignableUsers, currencies, commissionSummary] = await Promise.all([
    listCouriers(),
    getAssignableUsersForCourier(),
    getCurrencies(),
    getDeliveryCommissionSummary(),
  ]);

  return (
    <div className="p-4 md:p-6">
      <CourierListClient
        couriers={couriers}
        assignableUsers={assignableUsers}
        currencies={currencies}
        commissionSummary={commissionSummary}
      />
    </div>
  );
}
