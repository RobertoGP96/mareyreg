export const dynamic = "force-dynamic";

import { CourierListClient } from "@/modules/entregas/components/couriers/courier-list-client";
import {
  listCouriers,
  getAssignableUsersForCourier,
} from "@/modules/entregas/queries/courier-queries";
import { getDeliveryCommissionSummary } from "@/modules/entregas/queries/cash-delivery-queries";
import { getCurrencyOptions } from "@/modules/entregas/queries/catalog-queries";

export default async function MensajerosPage() {
  const [couriers, assignableUsers, currencies, commissionSummary] = await Promise.all([
    listCouriers(),
    getAssignableUsersForCourier(),
    getCurrencyOptions(),
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
