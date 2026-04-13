export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth-guard";
import { getUsers } from "@/modules/auth/queries/user-queries";
import { UserListClient } from "@/modules/auth/components/user-list-client";

export default async function UsersPage() {
  await requireRole(["admin"]);
  const users = await getUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Usuarios</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona los usuarios del sistema
        </p>
      </div>
      <UserListClient users={users} />
    </div>
  );
}
