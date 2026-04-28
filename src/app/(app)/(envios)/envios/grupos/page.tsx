export const dynamic = "force-dynamic";

import { AccountGroupListClient } from "@/modules/envios/components/groups/account-group-list-client";
import {
  getAccountGroups,
  getAssignableUsers,
} from "@/modules/envios/queries/account-group-queries";

export default async function GruposPage() {
  const [groups, users] = await Promise.all([
    getAccountGroups(),
    getAssignableUsers(),
  ]);
  return (
    <div className="p-4 md:p-6">
      <AccountGroupListClient initialGroups={groups} users={users} />
    </div>
  );
}
