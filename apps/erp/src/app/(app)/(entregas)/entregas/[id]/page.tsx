export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { DeliveryDetailClient } from "@/modules/entregas/components/deliveries/delivery-detail-client";
import { getCashDeliveryById } from "@/modules/entregas/queries/cash-delivery-queries";
import { searchRecipientsForPicker } from "@/modules/entregas/queries/recipient-queries";
import { getProviderPickerOptions } from "@/modules/entregas/queries/provider-queries";
import { getCourierPickerOptions } from "@/modules/entregas/queries/courier-queries";
import {
  getCurrencyOptions,
  getActiveDenominationsByCurrency,
} from "@/modules/entregas/queries/catalog-queries";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EntregaDetallePage({ params }: Props) {
  const { id } = await params;
  const deliveryId = Number(id);
  if (!Number.isFinite(deliveryId) || deliveryId <= 0) notFound();

  const [detail, recipients, providers, couriers, currencies, denominationsByCurrency, session] =
    await Promise.all([
      getCashDeliveryById(deliveryId),
      searchRecipientsForPicker(""),
      getProviderPickerOptions(),
      getCourierPickerOptions(),
      getCurrencyOptions(),
      getActiveDenominationsByCurrency(),
      auth(),
    ]);
  if (!detail) notFound();

  const rawUserId = session?.user?.userId ?? session?.user?.id;
  const currentUserId = rawUserId != null && Number.isFinite(Number(rawUserId)) ? Number(rawUserId) : null;

  return (
    <div className="p-4 md:p-6">
      <DeliveryDetailClient
        detail={detail}
        recipients={recipients}
        providers={providers}
        couriers={couriers}
        currencies={currencies}
        denominationsByCurrency={denominationsByCurrency}
        isAdmin={session?.user?.role === "admin"}
        currentUserId={currentUserId}
      />
    </div>
  );
}
