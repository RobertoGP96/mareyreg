import { PendingListClient } from "@/modules/envios/components/operations/pending-list-client";
import {
  getPendingOperations,
  getPendingSummary,
} from "@/modules/envios/queries/pending-queries";

export default async function PendientesPage() {
  const [pending, summary] = await Promise.all([
    getPendingOperations(),
    getPendingSummary(),
  ]);
  return (
    <div className="p-4 md:p-6">
      <PendingListClient initialPending={pending} summary={summary} />
    </div>
  );
}
