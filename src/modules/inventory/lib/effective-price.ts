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

type DiscountLike = {
  discountId: number;
  name: string;
  type: string;
  value: Prisma.Decimal | number;
  stackable: boolean;
};

/**
 * Lógica pura de resolución de precio dado el precio base ya determinado
 * (lista de cliente aplicada o no) y los descuentos ya filtrados por scope
 * (producto/categoría/global), vigencia y minQty para ese producto. Única
 * función que decide cómo se combinan descuentos no-acumulables/acumulables,
 * para que la variante unitaria y la batch nunca diverjan.
 */
function resolvePriceFromDiscounts(
  basePrice: number,
  discounts: DiscountLike[]
): EffectivePriceResult {
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

/**
 * Única fuente de verdad del precio de venta de un producto. Considera el
 * precio de lista del cliente (si tiene una asignada) como precio base, y
 * aplica los descuentos activos que correspondan (por producto, categoría o
 * globales, y opcionalmente por cliente). Si hay descuentos no acumulables
 * que aplican, se usa solo el de mayor descuento resultante; si todos los
 * que aplican son acumulables, se suman (capados para no superar el precio base).
 *
 * Delega en `getEffectivePrices` (variante batch) con un solo id, así ambas
 * nunca divergen. Para cálculos de más de un producto usar la batch
 * directamente y evitar el N+1 de queries.
 */
export async function getEffectivePrice(
  client: DbOrTx,
  params: { productId: number; quantity: number; customerId?: number; at?: Date }
): Promise<EffectivePriceResult> {
  const results = await getEffectivePrices(client, [params.productId], {
    quantity: params.quantity,
    customerId: params.customerId,
    at: params.at,
  });
  const result = results.get(params.productId);
  if (!result) {
    // findMany (batch) no lanza si un id no existe; findUniqueOrThrow sí.
    // Se preserva ese comportamiento para no romper callers de la unitaria.
    throw new Error(`Producto ${params.productId} no encontrado`);
  }
  return result;
}

export interface GetEffectivePricesOptions {
  /** Cantidad usada para evaluar minQty de descuentos por volumen. Igual para todos los productos del lote. */
  quantity: number;
  customerId?: number;
  at?: Date;
}

/**
 * Variante batch de getEffectivePrice: calcula el precio efectivo de varios
 * productos en 2-3 queries totales (productos + lista de precios del cliente
 * si aplica + descuentos por IN de productId/categoría), en vez de 2-4
 * queries por producto. Reutiliza exactamente la misma lógica de combinación
 * de descuentos que la variante unitaria vía resolvePriceFromDiscounts.
 */
export async function getEffectivePrices(
  client: DbOrTx,
  productIds: number[],
  opts: GetEffectivePricesOptions
): Promise<Map<number, EffectivePriceResult>> {
  const results = new Map<number, EffectivePriceResult>();
  const uniqueIds = Array.from(new Set(productIds));
  if (uniqueIds.length === 0) return results;

  const at = opts.at ?? new Date();

  const products = await client.product.findMany({
    where: { productId: { in: uniqueIds } },
    select: { productId: true, salePrice: true, category: true },
  });
  const productById = new Map(products.map((p) => [p.productId, p]));

  const priceListItemByProductId = new Map<number, Prisma.Decimal>();
  if (opts.customerId) {
    const customer = await client.customer.findUnique({
      where: { customerId: opts.customerId },
      select: { priceListId: true },
    });
    if (customer?.priceListId) {
      const items = await client.priceListItem.findMany({
        where: { priceListId: customer.priceListId, productId: { in: uniqueIds } },
        select: { productId: true, price: true },
      });
      for (const item of items) {
        priceListItemByProductId.set(item.productId, item.price);
      }
    }
  }

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter((c): c is string => c != null))
  );

  const scopeConditions: Prisma.DiscountWhereInput[] = [
    { productId: { in: uniqueIds } },
    { productId: null, category: null },
  ];
  if (categories.length > 0) {
    scopeConditions.push({ productId: null, category: { in: categories } });
  }

  const discounts = await client.discount.findMany({
    where: {
      isActive: true,
      OR: scopeConditions,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: at } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: at } }] },
        { OR: [{ minQty: null }, { minQty: { lte: opts.quantity } }] },
        {
          OR: [
            { customerId: null },
            ...(opts.customerId ? [{ customerId: opts.customerId }] : []),
          ],
        },
      ],
    },
  });

  const globalDiscounts = discounts.filter((d) => d.productId == null && d.category == null);
  const discountsByCategory = new Map<string, typeof discounts>();
  const discountsByProductId = new Map<number, typeof discounts>();
  for (const d of discounts) {
    if (d.productId != null) {
      const list = discountsByProductId.get(d.productId) ?? [];
      list.push(d);
      discountsByProductId.set(d.productId, list);
    } else if (d.category != null) {
      const list = discountsByCategory.get(d.category) ?? [];
      list.push(d);
      discountsByCategory.set(d.category, list);
    }
  }

  for (const productId of uniqueIds) {
    const product = productById.get(productId);
    if (!product) continue; // findMany no lanza para ids inexistentes; se omiten del resultado.

    let basePrice = product.salePrice != null ? Number(product.salePrice) : 0;
    const priceListItem = priceListItemByProductId.get(productId);
    if (priceListItem != null) basePrice = Number(priceListItem);

    const applicable = [
      ...(discountsByProductId.get(productId) ?? []),
      ...globalDiscounts,
      ...(product.category ? discountsByCategory.get(product.category) ?? [] : []),
    ];

    results.set(productId, resolvePriceFromDiscounts(basePrice, applicable));
  }

  return results;
}
