export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { OperationListClient } from "@/modules/envios/components/operations/operation-list-client";
import {
  getOperations,
  getOperationFormData,
} from "@/modules/envios/queries/operation-queries";

export default async function OperacionesPage() {
  const [operations, accounts, currencies] = await Promise.all([
    getOperations({ limit: 200 }),
    getOperationFormData(),
    db.currency.findMany({
      where: { active: true },
      select: { currencyId: true, code: true, symbol: true },
      orderBy: { code: "asc" },
    }),
  ]);
  return (
    <div className="p-4 md:p-6">
      <OperationListClient
        initialOperations={operations}
        accounts={accounts}
        currencies={currencies}
      />
    </div>
  );
}
