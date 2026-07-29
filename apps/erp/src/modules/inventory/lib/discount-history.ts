import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;

export interface WriteDiscountHistoryInput {
  discountId?: number | null;
  productId?: number | null;
  action: "created" | "updated" | "activated" | "deactivated" | "deleted";
  oldValues?: unknown;
  newValues?: unknown;
  changedBy: number;
}

export async function writeDiscountHistory(
  tx: PrismaTx,
  input: WriteDiscountHistoryInput
): Promise<void> {
  await tx.discountHistory.create({
    data: {
      discountId: input.discountId ?? null,
      productId: input.productId ?? null,
      action: input.action,
      oldValues: input.oldValues != null ? (JSON.parse(JSON.stringify(input.oldValues)) as Prisma.InputJsonValue) : undefined,
      newValues: input.newValues != null ? (JSON.parse(JSON.stringify(input.newValues)) as Prisma.InputJsonValue) : undefined,
      changedBy: input.changedBy,
    },
  });
}
