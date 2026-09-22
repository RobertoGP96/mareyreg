import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { getEnabledModules } from "@/lib/module-registry";
import { Badge } from "@/components/ui/badge";
import { ROLE_DEFS } from "@/modules/auth/lib/roles";
import { getRoleSummaries } from "@/modules/auth/queries/role-queries";
import { SettingsPageHeader } from "../_components/settings-page-header";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  await requireRole(["admin"]);

  const summaries = await getRoleSummaries();
  const byRole = new Map(summaries.map((s) => [s.role, s]));
  const enabledModules = getEnabledModules();
  const labelOf = new Map(enabledModules.map((m) => [m.id, m.label]));

  return (
    <>
      <SettingsPageHeader
        badge="Empresa"
        title="Roles del sistema"
        subtitle={`${ROLE_DEFS.length} roles fijos · cada rol concede módulos por defecto a sus miembros.`}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {ROLE_DEFS.map((r) => {
          const RoleIcon = r.icon;
          const summary = byRole.get(r.id);
          const count = summary?.memberCount ?? 0;
          const moduleIds = summary?.moduleIds ?? [];
          const isAdmin = r.id === "admin";
          return (
            <div
              key={r.id}
              className="group flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-[var(--brand)]/40 hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-md bg-[var(--accent)] text-[var(--accent-foreground)]">
                    <RoleIcon className="size-[18px]" />
                  </div>
                  <Badge variant={r.variant}>{r.name}</Badge>
                </div>
                <Link
                  href={`/settings/roles/${r.id}?tab=miembros`}
                  className="text-[11.5px] tabular-nums text-muted-foreground hover:text-foreground hover:underline"
                >
                  {count} usuario{count === 1 ? "" : "s"}
                </Link>
              </div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {r.description}
              </p>

              <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                {isAdmin ? (
                  <Badge variant="success">
                    Acceso total · {enabledModules.length} módulos
                  </Badge>
                ) : moduleIds.length === 0 ? (
                  <span className="text-[12px] text-muted-foreground">
                    Sin módulos por defecto
                  </span>
                ) : (
                  moduleIds.map((id) => (
                    <Badge key={id} variant="secondary">
                      {labelOf.get(id) ?? id}
                    </Badge>
                  ))
                )}
              </div>

              <div className="mt-auto flex items-center gap-3 pt-4">
                <Link
                  href={`/settings/roles/${r.id}?tab=permisos`}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--brand)] hover:underline"
                >
                  {isAdmin ? "Ver permisos" : "Editar permisos"}
                  <ChevronRight className="size-3.5" />
                </Link>
                <span className="text-muted-foreground/50">·</span>
                <Link
                  href={`/settings/roles/${r.id}?tab=miembros`}
                  className="text-[12px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  Ver miembros
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-[12px] leading-relaxed text-muted-foreground">
        Los roles son fijos. Los módulos individuales de cada persona se ajustan
        en{" "}
        <Link href="/settings/users" className="font-semibold text-[var(--brand)] hover:underline">
          Usuarios y permisos
        </Link>
        ; el acceso efectivo es la suma de ambos y se actualiza al iniciar sesión.
      </p>
    </>
  );
}
