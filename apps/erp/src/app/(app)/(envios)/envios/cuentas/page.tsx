export const dynamic = "force-dynamic";

import { AccountListClient } from "@/modules/envios/components/accounts/account-list-client";
import {
  getAccounts,
  getAccountFormData,
} from "@/modules/envios/queries/account-queries";

export default async function CuentasPage() {
  const [accounts, formData] = await Promise.all([
    getAccounts(),
    getAccountFormData(),
  ]);
  return (
    <div className="p-4 md:p-6">
      <AccountListClient
        initialAccounts={accounts}
        groups={formData.groups}
        currencies={formData.currencies}
        rules={formData.rules}
      />
    </div>
  );
}
