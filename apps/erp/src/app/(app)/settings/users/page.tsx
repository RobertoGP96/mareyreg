export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth-guard";
import { getUsers } from "@/modules/auth/queries/user-queries";
import { UserListClient } from "@/modules/auth/components/user-list-client";
import { SettingsPageHeader } from "../_components/settings-page-header";

export default async function UsersPage() {
  await requireRole(["admin"]);
  const users = await getUsers();

  const roleCount = new Set(users.map((u) => u.role)).size;

  return (
    <>
      <SettingsPageHeader
        badge="Empresa"
        title="Usuarios y permisos"
        subtitle={`${users.length} usuario${users.length === 1 ? "" : "s"} activo${users.length === 1 ? "" : "s"} · ${roleCount} rol${roleCount === 1 ? "" : "es"} definido${roleCount === 1 ? "" : "s"}`}
      />
      <UserListClient users={users} />
    </>
  );
}
