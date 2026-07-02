export const dynamic = "force-dynamic";

import {
  getSupplierBills,
  getAccountsPayableSummary,
  getReceivedPurchaseOrdersWithoutBill,
} from "@/modules/purchasing/queries/supplier-bill-queries";
import { getActiveSuppliersForPicker } from "@/modules/suppliers/queries/supplier-queries";
import { AccountsPayableClient } from "@/modules/purchasing/components/accounts-payable-client";

export default async function AccountsPayablePage() {
  const [bills, summary, receivablePOs, suppliers] = await Promise.all([
    getSupplierBills(),
    getAccountsPayableSummary(),
    getReceivedPurchaseOrdersWithoutBill(),
    getActiveSuppliersForPicker(),
  ]);

  return (
    <AccountsPayableClient
      bills={bills}
      suppliers={suppliers}
      receivablePOs={receivablePOs}
      summary={summary}
    />
  );
}
