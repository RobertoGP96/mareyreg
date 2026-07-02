export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getContractById } from "@/modules/carriers/queries/contract-queries";
import { ContractDetailClient } from "@/modules/carriers/components/contract-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContractDetailPage({ params }: Props) {
  const { id } = await params;
  const contractId = parseInt(id, 10);
  if (isNaN(contractId)) notFound();

  const contract = await getContractById(contractId);
  if (!contract) notFound();

  return (
    <div className="space-y-4">
      <ContractDetailClient contract={contract} />
    </div>
  );
}
