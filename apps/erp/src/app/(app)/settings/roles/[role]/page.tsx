import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { getEnabledModules } from "@/lib/module-registry";
import { Button } from "@/components/ui/button";
import { getRoleDef, isSystemRole } from "@/modules/auth/lib/roles";
import { getRoleDetail } from "@/modules/auth/queries/role-queries";
import { RoleDetailTabs } from "@/modules/auth/components/role-detail-tabs";
import { RolePermissionsEditor } from "@/modules/auth/components/role-permissions-editor";
import { RoleMembersList } from "@/modules/auth/components/role-members-list";
import { SettingsPageHeader } from "../../_components/settings-page-header";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function RoleDetailPage({ params, searchParams }: Props) {
  await requireRole(["admin"]);

  const [{ role }, { tab }] = await Promise.all([params, searchParams]);
  if (!isSystemRole(role)) notFound();

  const def = getRoleDef(role);
  const detail = await getRoleDetail(role);
  // Solo datos planos: el registry trae componentes de icono que no cruzan a cliente.
  const modules = getEnabledModules().map((m) => ({
    id: m.id,
    label: m.label,
    parentId: m.parentId,
  }));
  const moduleCount = role === "admin" ? modules.length : detail.moduleIds.length;

  return (
    <>
      <SettingsPageHeader
        badge={`Rol · ${def.name}`}
        title={def.name}
        subtitle={def.description}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/roles">
              <ArrowLeft className="size-4" />
              Roles
            </Link>
          </Button>
        }
      />

      <RoleDetailTabs
        defaultTab={tab === "miembros" ? "miembros" : "permisos"}
        moduleCount={moduleCount}
        memberCount={detail.members.length}
        permissions={
          <RolePermissionsEditor
            role={role}
            modules={modules}
            initialModuleIds={detail.moduleIds}
          />
        }
        members={
          <RoleMembersList
            role={role}
            members={detail.members}
            roleModuleIds={detail.moduleIds}
            modules={modules}
          />
        }
      />
    </>
  );
}
