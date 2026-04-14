import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

export type AuditAction = "create" | "update" | "delete" | string;

export interface AuditLogInput {
  action: AuditAction;
  entityType: string;
  entityId?: number | null;
  module: string;
  oldValues?: unknown;
  newValues?: unknown;
  userId?: number | null;
}

type PrismaTx = Prisma.TransactionClient;

export async function getCurrentUserId(): Promise<number | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const id = Number(session.user.id);
  return Number.isFinite(id) ? id : null;
}

export async function requireCurrentUserId(): Promise<number> {
  const id = await getCurrentUserId();
  if (id === null) throw new Error("No autenticado");
  return id;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function createAuditLog(
  client: PrismaTx | typeof db,
  input: AuditLogInput
): Promise<void> {
  const userId = input.userId ?? (await getCurrentUserId());
  await client.auditLog.create({
    data: {
      userId: userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      module: input.module,
      oldValues: toJson(input.oldValues),
      newValues: toJson(input.newValues),
    },
  });
}
