import { ShieldCheck, Settings2, Users, type LucideIcon } from "lucide-react";

export type SystemRole = "admin" | "dispatcher" | "viewer";

export const SYSTEM_ROLES: SystemRole[] = ["admin", "dispatcher", "viewer"];

export type RoleVariant = "brand" | "info" | "secondary";

export interface RoleDef {
  id: SystemRole;
  name: string;
  description: string;
  variant: RoleVariant;
  icon: LucideIcon;
}

export const ROLE_DEFS: RoleDef[] = [
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

export const ROLE_LABELS: Record<SystemRole, string> = {
  admin: "Administrador",
  dispatcher: "Despachador",
  viewer: "Observador",
};

export const ROLE_VARIANT: Record<SystemRole, RoleVariant> = {
  admin: "brand",
  dispatcher: "info",
  viewer: "secondary",
};

export function isSystemRole(value: unknown): value is SystemRole {
  return typeof value === "string" && (SYSTEM_ROLES as string[]).includes(value);
}

export function getRoleDef(role: SystemRole): RoleDef {
  const def = ROLE_DEFS.find((r) => r.id === role);
  if (!def) throw new Error(`Rol desconocido: ${role}`);
  return def;
}
