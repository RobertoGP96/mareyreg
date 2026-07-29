import type { Prisma } from "@/generated/prisma";
import { writeDiscountHistory } from "@/modules/inventory/lib/discount-history";

type PrismaTx = Prisma.TransactionClient;

export interface OfferHeaderInput {
  offerId: number;
  name: string;
  type: "percent" | "fixed";
  value: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export class OfferConflictError extends Error {}

/**
 * Materializa la oferta en N filas `Discount` (una por producto), dentro de
 * la misma transacción que la acción que la invoca. Mantiene la regla dura
 * "1 descuento activo por producto" (índice parcial `discount_one_active_per_product`):
 * si otro producto ya tiene un descuento activo de OTRA oferta, aborta con un
 * error legible; si tiene un descuento MANUAL activo, lo desactiva primero
 * (mismo patrón sibling-deactivation de `activateDiscount`).
 */
export async function syncOfferDiscounts(
  tx: PrismaTx,
  offer: OfferHeaderInput,
  productIds: number[],
  userId: number
): Promise<void> {
  const uniqueProductIds = Array.from(new Set(productIds));

  const products = await tx.product.findMany({
    where: { productId: { in: uniqueProductIds } },
    select: { productId: true, name: true, isActive: true, webstoreEnabled: true },
  });
  const productById = new Map(products.map((p) => [p.productId, p]));

  const missingIds = uniqueProductIds.filter((id) => !productById.has(id));
  if (missingIds.length > 0) {
    throw new Error(`Producto(s) no encontrado(s): ${missingIds.join(", ")}`);
  }
  const invalidProducts = products.filter((p) => !p.isActive || !p.webstoreEnabled);
  if (invalidProducts.length > 0) {
    const names = invalidProducts.map((p) => p.name).join(", ");
    throw new Error(
      `Los siguientes productos no están activos o no están habilitados en la tienda: ${names}`
    );
  }

  if (offer.isActive && uniqueProductIds.length > 0) {
    const conflicting = await tx.discount.findMany({
      where: {
        productId: { in: uniqueProductIds },
        isActive: true,
        offerId: { not: null, notIn: [offer.offerId] },
      },
      select: {
        discountId: true,
        productId: true,
        offer: { select: { offerId: true, name: true } },
      },
    });
    if (conflicting.length > 0) {
      const details = conflicting
        .map((d) => {
          const productName = productById.get(d.productId ?? -1)?.name ?? `#${d.productId}`;
          const offerName = d.offer?.name ?? "otra oferta";
          return `${productName} (oferta "${offerName}")`;
        })
        .join(", ");
      throw new OfferConflictError(
        `Los siguientes productos ya tienen una oferta activa: ${details}`
      );
    }

    const manualActive = await tx.discount.findMany({
      where: {
        productId: { in: uniqueProductIds },
        isActive: true,
        offerId: null,
      },
    });
    if (manualActive.length > 0) {
      const manualIds = manualActive.map((d) => d.discountId);
      await tx.discount.updateMany({
        where: { discountId: { in: manualIds } },
        data: { isActive: false, version: { increment: 1 } },
      });
      for (const d of manualActive) {
        await writeDiscountHistory(tx, {
          discountId: d.discountId,
          productId: d.productId,
          action: "deactivated",
          oldValues: { isActive: true },
          newValues: { isActive: false },
          changedBy: userId,
        });
      }
    }
  }

  const currentDiscounts = await tx.discount.findMany({
    where: { offerId: offer.offerId },
  });
  const currentByProductId = new Map(currentDiscounts.map((d) => [d.productId, d]));

  const mirrorData = {
    name: offer.name,
    type: offer.type,
    value: offer.value,
    startsAt: offer.startsAt,
    endsAt: offer.endsAt,
    isActive: offer.isActive,
  };

  const toRemove = currentDiscounts.filter((d) => d.productId == null || !uniqueProductIds.includes(d.productId));
  for (const d of toRemove) {
    await tx.discount.delete({ where: { discountId: d.discountId } });
    await writeDiscountHistory(tx, {
      discountId: null,
      productId: d.productId,
      action: "deleted",
      oldValues: d,
      changedBy: userId,
    });
  }

  for (const productId of uniqueProductIds) {
    const existing = currentByProductId.get(productId);
    if (existing) {
      await tx.discount.update({
        where: { discountId: existing.discountId },
        data: { ...mirrorData, version: { increment: 1 } },
      });
      await writeDiscountHistory(tx, {
        discountId: existing.discountId,
        productId,
        action: "updated",
        oldValues: existing,
        newValues: mirrorData,
        changedBy: userId,
      });
    } else {
      const created = await tx.discount.create({
        data: { ...mirrorData, productId, offerId: offer.offerId },
      });
      await writeDiscountHistory(tx, {
        discountId: created.discountId,
        productId,
        action: "created",
        newValues: mirrorData,
        changedBy: userId,
      });
    }
  }
}
