import { db } from "@/lib/db";
import { SYSTEM_ROLES, type SystemRole } from "../lib/roles";

export type RoleSummary = {
  role: SystemRole;
  memberCount: number;
  moduleIds: string[];
};

export type RoleMember = {
  userId: number;
  fullName: string;
  email: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  moduleIds: string[];
};

export type RoleDetail = {
  role: SystemRole;
  moduleIds: string[];
  members: RoleMember[];
};

export async function getRoleModuleMap(): Promise<Record<SystemRole, string[]>> {
  const rows = await db.roleModulePermission.findMany({
    orderBy: [{ role: "asc" }, { moduleId: "asc" }],
  });
  const map: Record<SystemRole, string[]> = { admin: [], dispatcher: [], viewer: [] };
  for (const row of rows) map[row.role].push(row.moduleId);
  return map;
}

export async function getRoleSummaries(): Promise<RoleSummary[]> {
  const [counts, moduleMap] = await Promise.all([
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    getRoleModuleMap(),
  ]);
  const countByRole = new Map(counts.map((c) => [c.role, c._count._all]));
  return SYSTEM_ROLES.map((role) => ({
    role,
    memberCount: countByRole.get(role) ?? 0,
    moduleIds: moduleMap[role],
  }));
}

export async function getRoleDetail(role: SystemRole): Promise<RoleDetail> {
  const [perms, users] = await Promise.all([
    db.roleModulePermission.findMany({
      where: { role },
      orderBy: { moduleId: "asc" },
      select: { moduleId: true },
    }),
    db.user.findMany({
      where: { role },
      orderBy: { fullName: "asc" },
      select: {
        userId: true,
        fullName: true,
        email: true,
        lastLoginAt: true,
        createdAt: true,
        modulePermissions: { select: { moduleId: true } },
      },
    }),
  ]);
  return {
    role,
    moduleIds: perms.map((p) => p.moduleId),
    members: users.map((u) => ({
      userId: u.userId,
      fullName: u.fullName,
      email: u.email,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      moduleIds: u.modulePermissions.map((p) => p.moduleId),
    })),
  };
}
