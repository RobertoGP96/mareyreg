export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AccountGroupDetailsClient } from "@/modules/envios/components/groups/account-group-details-client";
import { getGroupDetail } from "@/modules/envios/queries/account-group-queries";
import { getOperations } from "@/modules/envios/queries/operation-queries";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GrupoDetallePage({ params }: Props) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId) || groupId <= 0) notFound();

  const [group, operations] = await Promise.all([
    getGroupDetail(groupId),
    getOperations({ groupId, limit: 100 }),
  ]);
  if (!group) notFound();

  return (
    <div className="p-4 md:p-6">
      <AccountGroupDetailsClient group={group} operations={operations} />
    </div>
  );
}
