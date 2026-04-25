import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SettingsPageHeader } from "../_components/settings-page-header";
import { Plus, Settings2, Users, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

type RoleDef = {
  id: string;
  name: string;
  description: string;
  variant: "brand" | "warning" | "info" | "secondary";
  icon: typeof ShieldCheck;
};

const ROLE_DEFS: RoleDef[] = [
  {
    id: "admin",
    name: "Administrador",
    description: "Acceso total al sistema, gestión de usuarios y configuración.",
    variant: "brand",
    icon: ShieldCheck,
  },
  {
    id: "dispatcher",
    name: "Despachador",
    description: "Operación diaria de logística, viajes y pacas.",
    variant: "info",
    icon: Settings2,
  },
  {
    id: "viewer",
    name: "Observador",
    description: "Solo lectura. Acceso a reportes y dashboards.",
    variant: "secondary",
    icon: Users,
  },
];

export default async function RolesPage() {
  await requireRole(["admin"]);

  const counts = await db.user.groupBy({
    by: ["role"],
    _count: { _all: true },
  });
  const countByRole = Object.fromEntries(
    counts.map((c) => [c.role, c._count._all])
  );

  return (
    <>
      <SettingsPageHeader
        badge="Empresa"
        title="Roles del sistema"
        subtitle={`${ROLE_DEFS.length} roles definidos · controla permisos a nivel de módulo.`}
        actions={
          <Button variant="brand" size="sm">
            <Plus className="size-4" />
            Nuevo rol
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {ROLE_DEFS.map((r) => {
          const RoleIcon = r.icon;
          const count = countByRole[r.id] ?? 0;
          return (
            <div
              key={r.id}
              className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-[var(--brand)]/40 hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-md bg-[var(--accent)] text-[var(--accent-foreground)]">
                    <RoleIcon className="size-[18px]" />
                  </div>
                  <Badge variant={r.variant}>{r.name}</Badge>
                </div>
                <span className="text-[11.5px] tabular-nums text-muted-foreground">
                  {count} usuario{count === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {r.description}
              </p>
              <div className="mt-3.5 flex items-center gap-3">
                <button
                  type="button"
                  className="text-[12px] font-semibold text-[var(--brand)] hover:underline cursor-pointer"
                >
                  Editar permisos
                </button>
                <span className="text-muted-foreground/50">·</span>
                <button
                  type="button"
                  className="text-[12px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Ver miembros
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
