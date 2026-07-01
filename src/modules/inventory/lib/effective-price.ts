import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;
type DbOrTx = PrismaTx | typeof db;

export interface AppliedDiscount {
  discountId: number;
  name: string;
  discountAmount: number;
}

export interface EffectivePriceResult {
  basePrice: number;
  finalPrice: number;
  appliedDiscounts: AppliedDiscount[];
}

function discountAmount(
  discount: { type: string; value: Prisma.Decimal | number },
  basePrice: number
): number {
  const value = Number(discount.value);
  if (discount.type === "fixed") return Math.min(value, basePrice);
  // "percent" y "volume" se calculan igual: value es un porcentaje.
  return Math.min(basePrice * (value / 100), basePrice);
}

/**
 * Única fuente de verdad del precio de venta de un producto. Considera el
 * precio de lista del cliente (si tiene una asignada) como precio base, y
 * aplica los descuentos activos que correspondan (por producto, categoría o
 * globales, y opcionalmente por cliente). Si hay descuentos no acumulables
 * que aplican, se usa solo el de mayor descuento resultante; si todos los
 * que aplican son acumulables, se suman (capados para no superar el precio base).
 */
export async function getEffectivePrice(
  client: DbOrTx,
  params: { productId: number; quantity: number; customerId?: number; at?: Date }
): Promise<EffectivePriceResult> {
  const at = params.at ?? new Date();

  const product = await client.product.findUniqueOrThrow({
    where: { productId: params.productId },
    select: { salePrice: true, category: true },
  });

  let basePrice = product.salePrice != null ? Number(product.salePrice) : 0;

  if (params.customerId) {
    const customer = await client.customer.findUnique({
      where: { customerId: params.customerId },
      select: { priceListId: true },
    });
    if (customer?.priceListId) {
      const item = await client.priceListItem.findUnique({
        where: {
          priceListId_productId: {
            priceListId: customer.priceListId,
            productId: params.productId,
          },
        },
      });
      if (item) basePrice = Number(item.price);
    }
  }

  const scopeConditions: Prisma.DiscountWhereInput[] = [
    { productId: params.productId },
    { productId: null, category: null },
  ];
  if (product.category) {
    scopeConditions.push({ productId: null, category: product.category });
  }

  const discounts = await client.discount.findMany({
    where: {
      isActive: true,
      OR: scopeConditions,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: at } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: at } }] },
        { OR: [{ minQty: null }, { minQty: { lte: params.quantity } }] },
        {
          OR: [
            { customerId: null },
            ...(params.customerId ? [{ customerId: params.customerId }] : []),
          ],
        },
      ],
    },
  });

  const nonStackable = discounts.filter((d) => !d.stackable);
  const stackable = discounts.filter((d) => d.stackable);

  const appliedDiscounts: AppliedDiscount[] = [];
  let finalPrice = basePrice;

  if (nonStackable.length > 0) {
    const best = nonStackable.reduce((a, b) =>
      discountAmount(b, basePrice) > discountAmount(a, basePrice) ? b : a
    );
    const amount = discountAmount(best, basePrice);
    finalPrice = Math.max(0, basePrice - amount);
    appliedDiscounts.push({ discountId: best.discountId, name: best.name, discountAmount: amount });
  } else if (stackable.length > 0) {
    let total = 0;
    for (const d of stackable) {
      const amount = discountAmount(d, basePrice);
      total += amount;
      appliedDiscounts.push({ discountId: d.discountId, name: d.name, discountAmount: amount });
    }
    total = Math.min(total, basePrice);
    finalPrice = Math.max(0, basePrice - total);
  }

  return { basePrice, finalPrice, appliedDiscounts };
}
