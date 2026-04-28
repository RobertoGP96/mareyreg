export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AccountDetailsClient } from "@/modules/envios/components/accounts/account-details-client";
import {
  getAccountDetail,
  getAccountFormData,
} from "@/modules/envios/queries/account-queries";
import { getOperations } from "@/modules/envios/queries/operation-queries";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CuentaDetallePage({ params }: Props) {
  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isFinite(accountId) || accountId <= 0) notFound();

  const [account, operations, formData] = await Promise.all([
    getAccountDetail(accountId),
    getOperations({ accountId, limit: 100 }),
    getAccountFormData(),
  ]);
  if (!account) notFound();

  return (
    <div className="p-4 md:p-6">
      <AccountDetailsClient
        account={account}
        operations={operations}
        rules={formData.rules}
        currencies={formData.currencies}
      />
    </div>
  );
}
