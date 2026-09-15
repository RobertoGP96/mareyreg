"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import { modelGroupInputSchema, type ModelGroupInput } from "../lib/model-group-schemas";
import {
  syncModelGroupMembers,
  ModelGroupConflictError,
  type SyncModelGroupResult,
} from "../lib/sync-model-group-members";
import {
  MODEL_GROUP_NOT_FOUND_MESSAGE as NOT_FOUND_MESSAGE,
  MODEL_GROUP_STALE_MESSAGE as STALE_MESSAGE,
} from "../lib/model-group-messages";

const FORBIDDEN_ERROR_MESSAGE = "No tienes permisos para realizar esta acción";
const DUPLICATE_LABEL_MESSAGE = "Ya existe un modelo con esa etiqueta en este grupo";

type PrismaTx = Prisma.TransactionClient;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function revalidateModelGroupSurfaces(): void {
  revalidatePath("/webstore/catalogo");
}

async function auditMemberChanges(
  tx: PrismaTx,
  groupId: number,
  result: SyncModelGroupResult,
  userId: number
): Promise<void> {
  for (const prev of result.removed) {
    await createAuditLog(tx, {
      action: "update",
      entityType: "Product",
      entityId: prev.productId,
      module: "webstore",
      userId,
      oldValues: { modelGroupId: prev.modelGroupId, modelLabel: prev.modelLabel, modelSortOrder: prev.modelSortOrder },
      newValues: { modelGroupId: null, modelLabel: null, modelSortOrder: 0 },
    });
  }
  for (const { prev, next } of result.changed) {
    await createAuditLog(tx, {
      action: "update",
      entityType: "Product",
      entityId: prev.productId,
      module: "webstore",
      userId,
      oldValues: { modelGroupId: prev.modelGroupId, modelLabel: prev.modelLabel, modelSortOrder: prev.modelSortOrder },
      newValues: { modelGroupId: groupId, modelLabel: next.modelLabel, modelSortOrder: next.modelSortOrder },
    });
  }
}

/** Errores de negocio con mensaje propio; `null` = inesperado (loguear y usar fallback). */
function mapKnownError(error: unknown): ActionResult<never> | null {
  if (error instanceof Error && error.message === "No autenticado") {
    return { success: false, error: "Debes iniciar sesión para realizar esta acción." };
  }
  if (error instanceof ForbiddenError) {
    return { success: false, error: FORBIDDEN_ERROR_MESSAGE };
  }
  if (error instanceof ModelGroupConflictError) {
    return { success: false, error: error.message };
  }
  if (isUniqueViolation(error)) {
    return { success: false, error: DUPLICATE_LABEL_MESSAGE };
  }
  if (error instanceof Error && error.message === "NOT_FOUND") {
    return { success: false, error: NOT_FOUND_MESSAGE };
  }
  if (error instanceof Error && error.message === "STALE_VERSION") {
    return { success: false, error: STALE_MESSAGE };
  }
  return null;
}

export async function createModelGroup(
  input: ModelGroupInput
): Promise<ActionResult<{ groupId: number }>> {
  const parsed = modelGroupInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");

    const group = await db.$transaction(async (tx) => {
      const created = await tx.webstoreModelGroup.create({
        data: { name: data.name, optionLabel: data.optionLabel, createdBy: userId },
      });

      const sync = await syncModelGroupMembers(tx, created.groupId, data.members);

      await createAuditLog(tx, {
        action: "create",
        entityType: "WebstoreModelGroup",
        entityId: created.groupId,
        module: "webstore",
        userId,
        newValues: data,
      });
      await auditMemberChanges(tx, created.groupId, sync, userId);

      return created;
    });

    revalidateModelGroupSurfaces();
    return { success: true, data: { groupId: group.groupId } };
  } catch (error) {
    const known = mapKnownError(error);
    if (known) return known;
    console.error("createModelGroup:", error);
    return { success: false, error: "Error al crear el grupo de modelos" };
  }
}

export async function updateModelGroup(
  groupId: number,
  input: ModelGroupInput
): Promise<ActionResult<void>> {
  const parsed = modelGroupInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin", "dispatcher");

    await db.$transaction(async (tx) => {
      const prev = await tx.webstoreModelGroup.findUnique({ where: { groupId } });
      if (!prev) throw new Error("NOT_FOUND");

      const updateData = {
        name: data.name,
        optionLabel: data.optionLabel,
        version: { increment: 1 },
      };

      if (data.version !== undefined) {
        const res = await tx.webstoreModelGroup.updateMany({
          where: { groupId, version: data.version },
          data: updateData,
        });
        if (res.count === 0) throw new Error("STALE_VERSION");
      } else {
        await tx.webstoreModelGroup.update({ where: { groupId }, data: updateData });
      }

      const sync = await syncModelGroupMembers(tx, groupId, data.members);

      await createAuditLog(tx, {
        action: "update",
        entityType: "WebstoreModelGroup",
        entityId: groupId,
        module: "webstore",
        userId,
        oldValues: prev,
        newValues: data,
      });
      await auditMemberChanges(tx, groupId, sync, userId);
    });

    revalidateModelGroupSurfaces();
    return { success: true, data: undefined };
  } catch (error) {
    const known = mapKnownError(error);
    if (known) return known;
    console.error("updateModelGroup:", error);
    return { success: false, error: "Error al actualizar el grupo de modelos" };
  }
}

export async function deleteModelGroup(groupId: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin");

    await db.$transaction(async (tx) => {
      const group = await tx.webstoreModelGroup.findUnique({
        where: { groupId },
        include: {
          products: { select: { productId: true, modelLabel: true, modelSortOrder: true } },
        },
      });
      if (!group) throw new Error("NOT_FOUND");

      // FK Restrict: los miembros se sueltan en la MISMA tx antes de borrar.
      await tx.product.updateMany({
        where: { modelGroupId: groupId },
        data: { modelGroupId: null, modelLabel: null, modelSortOrder: 0 },
      });
      for (const p of group.products) {
        await createAuditLog(tx, {
          action: "update",
          entityType: "Product",
          entityId: p.productId,
          module: "webstore",
          userId,
          oldValues: { modelGroupId: groupId, modelLabel: p.modelLabel, modelSortOrder: p.modelSortOrder },
          newValues: { modelGroupId: null, modelLabel: null, modelSortOrder: 0 },
        });
      }

      await tx.webstoreModelGroup.delete({ where: { groupId } });

      await createAuditLog(tx, {
        action: "delete",
        entityType: "WebstoreModelGroup",
        entityId: groupId,
        module: "webstore",
        userId,
        oldValues: group,
      });
    });

    revalidateModelGroupSurfaces();
    return { success: true, data: undefined };
  } catch (error) {
    const known = mapKnownError(error);
    if (known) return known;
    console.error("deleteModelGroup:", error);
    return { success: false, error: "Error al eliminar el grupo de modelos" };
  }
}
