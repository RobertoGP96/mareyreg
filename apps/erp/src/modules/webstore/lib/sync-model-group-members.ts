import type { Prisma } from "@/generated/prisma";
import { modelGroupMembershipIssue, type ModelGroupMemberFacts } from "./model-group-rules";
import type { ModelGroupMemberInput } from "./model-group-schemas";

type PrismaTx = Prisma.TransactionClient;

export class ModelGroupConflictError extends Error {}

export interface ModelGroupMemberSnapshot extends ModelGroupMemberFacts {
  modelLabel: string | null;
  modelSortOrder: number;
}

export interface SyncModelGroupResult {
  /** Miembros que salieron del grupo (valores previos, para auditoría). */
  removed: ModelGroupMemberSnapshot[];
  /** Miembros que entraron o cambiaron etiqueta/orden. */
  changed: Array<{ prev: ModelGroupMemberSnapshot; next: ModelGroupMemberInput }>;
}

const MEMBER_SELECT = {
  productId: true,
  name: true,
  sku: true,
  unit: true,
  isCatchWeight: true,
  isService: true,
  modelGroupId: true,
  modelLabel: true,
  modelSortOrder: true,
} as const;

const DETACHED = { modelGroupId: null, modelLabel: null, modelSortOrder: 0 } as const;

const normalizeLabel = (label: string | null): string => (label ?? "").trim().toLowerCase();

/**
 * `Product` no tiene `version`: la membresía se escribe condicionada al
 * `modelGroupId` leído en esta misma tx, así dos grupos creados a la vez no
 * pueden "ganar" el mismo producto (el segundo UPDATE ve 0 filas y aborta).
 */
async function updateMembership(
  tx: PrismaTx,
  product: { productId: number; name: string },
  expectedGroupId: number | null,
  data: { modelGroupId: number | null; modelLabel: string | null; modelSortOrder: number }
): Promise<void> {
  const res = await tx.product.updateMany({
    where: { productId: product.productId, modelGroupId: expectedGroupId },
    data,
  });
  if (res.count !== 1) {
    throw new ModelGroupConflictError(
      `«${product.name}» fue modificado por otra persona. Recarga e intenta de nuevo.`
    );
  }
}

/**
 * Sincroniza la membresía de un grupo de modelos dentro de la transacción de
 * la action: los productos que ya no vienen en `members` se sueltan, los
 * nuevos o modificados se actualizan por `productId`. Valida el conjunto FINAL
 * con `modelGroupMembershipIssue` antes de escribir, así un grupo mixto
 * (unidad / peso variable) nunca llega a la base.
 */
export async function syncModelGroupMembers(
  tx: PrismaTx,
  groupId: number,
  members: ModelGroupMemberInput[]
): Promise<SyncModelGroupResult> {
  const memberIds = Array.from(new Set(members.map((m) => m.productId)));

  const current = await tx.product.findMany({
    where: { modelGroupId: groupId },
    select: MEMBER_SELECT,
  });
  const candidates = await tx.product.findMany({
    where: { productId: { in: memberIds } },
    select: MEMBER_SELECT,
  });
  const candidateById = new Map(candidates.map((c) => [c.productId, c]));

  const missing = memberIds.filter((id) => !candidateById.has(id));
  if (missing.length > 0) {
    throw new ModelGroupConflictError(
      `Producto(s) no encontrado(s): ${missing.map((id) => `#${id}`).join(", ")}`
    );
  }

  for (const candidate of candidates) {
    const issue = modelGroupMembershipIssue(candidates, candidate, groupId);
    if (issue) throw new ModelGroupConflictError(issue);
  }

  const currentById = new Map(current.map((c) => [c.productId, c]));
  const removed = current.filter((c) => !candidateById.has(c.productId));
  for (const row of removed) {
    await updateMembership(tx, row, groupId, DETACHED);
  }

  const changed: SyncModelGroupResult["changed"] = [];
  for (const member of members) {
    const prev = candidateById.get(member.productId)!;
    const existing = currentById.get(member.productId);
    const unchanged =
      existing != null &&
      existing.modelLabel === member.modelLabel &&
      existing.modelSortOrder === member.modelSortOrder;
    if (!unchanged) changed.push({ prev, next: member });
  }

  // El índice único parcial por etiqueta se evalúa por sentencia: intercambiar
  // dos etiquetas ("M"<->"L") en updates sucesivos chocaría con la fila aún no
  // tocada. Los miembros que cambian de etiqueta se sueltan primero.
  const relabeled = changed.filter(
    ({ prev, next }) =>
      prev.modelGroupId === groupId && normalizeLabel(prev.modelLabel) !== normalizeLabel(next.modelLabel)
  );
  const detachedIds = new Set<number>();
  for (const { prev } of relabeled) {
    await updateMembership(tx, prev, groupId, DETACHED);
    detachedIds.add(prev.productId);
  }

  for (const { prev, next } of changed) {
    await updateMembership(tx, prev, detachedIds.has(prev.productId) ? null : prev.modelGroupId, {
      modelGroupId: groupId,
      modelLabel: next.modelLabel,
      modelSortOrder: next.modelSortOrder,
    });
  }

  return { removed, changed };
}
