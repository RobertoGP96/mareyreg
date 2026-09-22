"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import type { ActionResult } from "@/types";
import { isSystemRole, type SystemRole } from "../lib/roles";
import { sanitizeModuleIds } from "../lib/effective-modules";

export async function updateRoleModules(
  role: SystemRole,
  moduleIds: string[]
): Promise<ActionResult<{ moduleIds: string[] }>> {
  try {
    if (!isSystemRole(role)) {
      return { success: false, error: "El rol indicado no existe" };
    }
    if (role === "admin") {
      return {
        success: false,
        error: "El administrador tiene acceso total; sus módulos no se editan",
      };
    }
    const userId = await requireCurrentUserId();
    await assertRole("admin");

    const next = sanitizeModuleIds(moduleIds);

    await db.$transaction(async (tx) => {
      const current = await tx.roleModulePermission.findMany({
        where: { role },
        select: { moduleId: true },
      });
      await tx.roleModulePermission.deleteMany({ where: { role } });
      if (next.length > 0) {
        await tx.roleModulePermission.createMany({
          data: next.map((moduleId) => ({ role, moduleId })),
        });
      }
      await createAuditLog(tx, {
        action: "update",
        entityType: "Role",
        entityId: null,
        module: "auth",
        userId,
        oldValues: { role, moduleIds: current.map((c) => c.moduleId) },
        newValues: { role, moduleIds: next },
      });
    });

    revalidatePath("/settings/roles");
    revalidatePath(`/settings/roles/${role}`);
    revalidatePath("/settings/users");
    return { success: true, data: { moduleIds: next } };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("updateRoleModules:", error);
    return { success: false, error: "No se pudieron guardar los permisos del rol" };
  }
}
