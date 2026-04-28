import { OperationListClient } from "@/modules/envios/components/operations/operation-list-client";
import {
  getOperations,
  getOperationFormData,
} from "@/modules/envios/queries/operation-queries";

export default async function OperacionesPage() {
  const [operations, accounts] = await Promise.all([
    getOperations({ limit: 200 }),
    getOperationFormData(),
  ]);
  return (
    <div className="p-4 md:p-6">
      <OperationListClient initialOperations={operations} accounts={accounts} />
    </div>
  );
}
