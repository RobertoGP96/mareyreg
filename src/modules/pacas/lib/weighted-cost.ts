import type { Prisma } from "@/generated/prisma";

export function calculateWeightedCost(
  inventory: { available: number; reserved: number; totalCost: Prisma.Decimal | number } | null,
  quantity: number
): { avgCost: number; costToDeduct: number } {
  const totalInStock = (inventory?.available ?? 0) + (inventory?.reserved ?? 0);
  const avgCost = totalInStock > 0 ? Number(inventory?.totalCost ?? 0) / totalInStock : 0;
  const costToDeduct = avgCost * quantity;
  return { avgCost, costToDeduct };
}
