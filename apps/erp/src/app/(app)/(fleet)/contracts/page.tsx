export const dynamic = "force-dynamic";

import {
  getContracts,
  getDriversForContract,
} from "@/modules/carriers/queries/contract-queries";
import { ContractListClient } from "@/modules/carriers/components/contract-list-client";

export default async function ContractsPage() {
  const [contracts, drivers] = await Promise.all([
    getContracts(),
    getDriversForContract(),
  ]);

  return (
    <div className="space-y-4">
      <ContractListClient initialContracts={contracts} drivers={drivers} />
    </div>
  );
}
