import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { SettingsPageHeader } from "../_components/settings-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvatarInitials } from "@/components/ui/avatar";
import { History, Download, Filter } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

const ACTION_VARIANT: Record<
  string,
  "brand" | "success" | "warning" | "destructive" | "secondary"
> = {
  create: "success",
  update: "info" as never, // Badge has no info-only variant; falls back below
  delete: "destructive",
  login: "secondary",
};

function actionLabel(a: string) {
  const map: Record<string, string> = {
    create: "Creación",
    update: "Actualización",
    delete: "Eliminación",
    login: "Inicio de sesión",
  };
  return map[a] ?? a;
}

function timeAgo(d: Date) {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Ahora";
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `Hace ${days} día${days === 1 ? "" : "s"}`;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export default async function AuditPage() {
  await requireRole(["admin"]);

  const logs = await db.auditLog.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { fullName: true, email: true } },
    },
  });

  return (
    <>
      <SettingsPageHeader
        badge="Empresa"
        title="Auditoría"
        subtitle={`${logs.length} eventos recientes · trazabilidad completa de cambios.`}
        actions={
          <>
            <Button variant="secondary" size="sm">
              <Filter className="size-4" />
              Filtros
            </Button>
            <Button variant="brand" size="sm">
              <Download className="size-4" />
              Exportar
            </Button>
          </>
        }
      />

      <div className="rounded-xl border border-border bg-card shadow-sm">
        {logs.length === 0 ? (
          <EmptyState
            icon={<History className="size-10" />}
            title="Sin eventos aún"
            description="Cuando los usuarios realicen cambios en el sistema, los verás aquí."
          />
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted/50 text-left">
                {["Usuario", "Acción", "Entidad", "Módulo", "Fecha"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const variant = ACTION_VARIANT[log.action] ?? "secondary";
                return (
                  <tr
                    key={log.logId}
                    className="border-t border-border hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5">
                      {log.user ? (
                        <div className="flex items-center gap-2.5">
                          <AvatarInitials
                            name={log.user.fullName}
                            size={26}
                          />
                          <div>
                            <div className="text-[12.5px] font-semibold text-foreground">
                              {log.user.fullName}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {log.user.email}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Sistema</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={variant === "info" as never ? "info" : variant}>
                        {actionLabel(log.action)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[11.5px] text-muted-foreground">
                        {log.entityType}
                      </span>
                      {log.entityId != null && (
                        <span className="ml-1.5 font-mono text-[11.5px] text-foreground">
                          #{log.entityId}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="capitalize">
                        {log.module}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground">
                      {timeAgo(log.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
