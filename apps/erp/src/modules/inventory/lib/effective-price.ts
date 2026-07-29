import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { toBaseQuantity } from "./units";
import { getBaseCurrency, getRateToBase, roundToCurrency } from "@/lib/currency";

type PrismaTx = Prisma.TransactionClient;
type DbOrTx = PrismaTx | typeof db;

export interface AppliedDiscount {
  discountId: number;
  name: string;
  discountAmount: number;
}

export interface EffectivePriceResult {
  /** Precio base ya convertido a moneda BASE (CUP), antes de descuentos. */
  basePrice: number;
  /** Precio final tras descuentos, convertido a base y redondeado (roundToCurrency). */
  finalPrice: number;
  appliedDiscounts: AppliedDiscount[];
  /** Moneda original del precio antes de convertir a base. null = ya estaba en base. */
  priceCurrencyId?: number | null;
  /** Tasa aplicada para llevar el precio a base. null si ya estaba en base. */
  rateApplied?: number | null;
}

/**
 * Cache de tasas por moneda para no repetir `getRateToBase` por cada línea
 * cuando varias comparten la misma moneda de precio dentro de un mismo batch.
 */
class RateCache {
  private readonly rates = new Map<number, number>();

  constructor(
    private readonly client: DbOrTx,
    private readonly baseCurrencyId: number
  ) {}

  async rateFor(currencyId: number | null | undefined): Promise<number | null> {
    if (currencyId == null || currencyId === this.baseCurrencyId) return null;
    const cached = this.rates.get(currencyId);
    if (cached != null) return cached;
    const { rate } = await getRateToBase(this.client, currencyId);
    this.rates.set(currencyId, rate);
    return rate;
  }
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
};

/**
 * Lógica pura de resolución de precio dado el precio base ya determinado
 * (lista de cliente aplicada o no) y los descuentos ya filtrados por scope
 * (producto/categoría/global), vigencia y minQty para ese producto. Regla de
 * negocio: solo se aplica UN descuento a la vez — el de mayor beneficio para
 * el cliente — para que la variante unitaria y la batch nunca diverjan.
 *
 * `basePrice` YA debe venir convertido a moneda base (CUP) por el caller —
 * esta función es agnóstica de moneda. Los descuentos porcentuales/volumen
 * funcionan igual sobre el monto en base; los descuentos "fixed" se asumen
 * definidos en moneda base (hoy no existe un `currencyId` en `Discount`, así
 * que no hay conversión posible para ese monto — documentado aquí para no
 * repetir la investigación si se agrega soporte multi-moneda a descuentos).
 * El redondeo final a la moneda base ocurre DESPUÉS del descuento.
 */
function resolvePriceFromDiscounts(
  basePrice: number,
  discounts: DiscountLike[],
  baseDecimalPlaces: number
): EffectivePriceResult {
  const appliedDiscounts: AppliedDiscount[] = [];
  let finalPrice = basePrice;

  if (discounts.length > 0) {
    const best = discounts.reduce((a, b) =>
      discountAmount(b, basePrice) > discountAmount(a, basePrice) ? b : a
    );
    const amount = discountAmount(best, basePrice);
    finalPrice = Math.max(0, basePrice - amount);
    appliedDiscounts.push({ discountId: best.discountId, name: best.name, discountAmount: amount });
  }

  return {
    basePrice,
    finalPrice: roundToCurrency(finalPrice, baseDecimalPlaces),
    appliedDiscounts,
  };
}

/**
 * Única fuente de verdad del precio de venta de un producto. Considera el
 * precio de lista del cliente (si tiene una asignada) como precio base, y
 * aplica los descuentos activos que correspondan (por producto, categoría o
 * globales, y opcionalmente por cliente). Solo se aplica un descuento a la
 * vez: el de mayor beneficio para el cliente entre los aplicables.
 *
 * Delega en `getEffectivePrices` (variante batch) con un solo id, así ambas
 * nunca divergen. Para cálculos de más de un producto usar la batch
 * directamente y evitar el N+1 de queries.
 */
export async function getEffectivePrice(
  client: DbOrTx,
  params: {
    productId: number;
    quantity: number;
    customerId?: number;
    presentationId?: number | null;
    at?: Date;
  }
): Promise<EffectivePriceResult> {
  if (params.presentationId != null) {
    const results = await getEffectiveLinePrices(
      client,
      [{ productId: params.productId, presentationId: params.presentationId, quantity: params.quantity }],
      { customerId: params.customerId, at: params.at }
    );
    const result = results.get(lineKey(params.productId, params.presentationId));
    if (!result) throw new Error(`Producto ${params.productId} no encontrado`);
    return result;
  }
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

  const [base, products] = await Promise.all([
    getBaseCurrency(client),
    client.product.findMany({
      where: { productId: { in: uniqueIds } },
      select: { productId: true, salePrice: true, saleCurrencyId: true, category: true },
    }),
  ]);
  const productById = new Map(products.map((p) => [p.productId, p]));
  const rateCache = new RateCache(client, base.currencyId);

  const priceListItemByProductId = new Map<number, { price: Prisma.Decimal; currencyId: number | null }>();
  if (opts.customerId) {
    const customer = await client.customer.findUnique({
      where: { customerId: opts.customerId },
      select: { priceListId: true },
    });
    if (customer?.priceListId) {
      const items = await client.priceListItem.findMany({
        where: { priceListId: customer.priceListId, productId: { in: uniqueIds } },
        select: { productId: true, price: true, currencyId: true },
      });
      for (const item of items) {
        priceListItemByProductId.set(item.productId, { price: item.price, currencyId: item.currencyId });
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

    let rawPrice = product.salePrice != null ? Number(product.salePrice) : 0;
    let priceCurrencyId: number | null = product.saleCurrencyId;
    const priceListItem = priceListItemByProductId.get(productId);
    if (priceListItem != null) {
      rawPrice = Number(priceListItem.price);
      priceCurrencyId = priceListItem.currencyId;
    }

    const rateApplied = await rateCache.rateFor(priceCurrencyId);
    const basePrice = rateApplied != null ? rawPrice * rateApplied : rawPrice;

    const applicable = [
      ...(discountsByProductId.get(productId) ?? []),
      ...globalDiscounts,
      ...(product.category ? discountsByCategory.get(product.category) ?? [] : []),
    ];

    results.set(productId, {
      ...resolvePriceFromDiscounts(basePrice, applicable, base.decimalPlaces),
      priceCurrencyId,
      rateApplied,
    });
  }

  return results;
}

export interface EffectiveLineInput {
  productId: number;
  presentationId?: number | null;
  quantity: number;
}

export interface EffectiveLinePriceResult extends EffectivePriceResult {
  /** Unidades base por unidad vendida (1 para la base o sin presentación). */
  factor: number;
  /**
   * Precio final POR KG (unidad base) para productos catch-weight, resuelto
   * SIEMPRE desde la presentación base del producto (lista de precios del
   * cliente y descuentos evaluados igual que para la base), sin importar qué
   * presentación (Pieza/Caja) se vendió en la línea. undefined para productos
   * normales — el precio de la línea ya es el correcto vía basePrice/finalPrice.
   */
  pricePerBase?: number;
}

/** Llave del resultado de getEffectiveLinePrices para una línea. */
export function lineKey(productId: number, presentationId?: number | null): string {
  return `${productId}:${presentationId ?? "base"}`;
}

/**
 * Precio efectivo por línea de venta considerando la presentación vendida
 * (lata vs caja) y el tipo de cliente. Reglas:
 *
 * - Sin `presentationId`: mismo comportamiento que getEffectivePrices
 *   (salePrice del producto, lista de precios del cliente si tiene), factor 1.
 * - Con `presentationId`: el precio base es wholesalePrice si el cliente es
 *   `wholesale` y la presentación lo define; si no, retailPrice. La lista de
 *   precios del cliente SOLO sobrescribe la presentación base — las no-base
 *   tienen precio explícito propio.
 * - Descuentos: misma lógica de "un solo descuento, el de mayor beneficio";
 *   el `minQty` de descuentos por volumen se evalúa en unidades BASE
 *   (quantity × factor), así "1 caja de 24" y "24 latas" activan lo mismo.
 *
 * Lanza error en español si la presentación no existe, no pertenece al
 * producto o está inactiva (defensa server-side: el factor y el precio nunca
 * se aceptan del cliente).
 */
export async function getEffectiveLinePrices(
  client: DbOrTx,
  lines: EffectiveLineInput[],
  opts: { customerId?: number; at?: Date } = {}
): Promise<Map<string, EffectiveLinePriceResult>> {
  const results = new Map<string, EffectiveLinePriceResult>();
  if (lines.length === 0) return results;

  const at = opts.at ?? new Date();
  const uniqueProductIds = Array.from(new Set(lines.map((l) => l.productId)));
  const uniquePresentationIds = Array.from(
    new Set(
      lines
        .map((l) => l.presentationId)
        .filter((id): id is number => id != null)
    )
  );

  const [base, products] = await Promise.all([
    getBaseCurrency(client),
    client.product.findMany({
      where: { productId: { in: uniqueProductIds } },
      select: {
        productId: true,
        salePrice: true,
        saleCurrencyId: true,
        category: true,
        isCatchWeight: true,
      },
    }),
  ]);
  const productById = new Map(products.map((p) => [p.productId, p]));
  const rateCache = new RateCache(client, base.currencyId);

  // Productos catch-weight necesitan su presentación BASE para resolver
  // pricePerBase, sin importar si la línea vendió Pieza/Caja (no-base) — se
  // agrega aunque no venga en uniquePresentationIds para no hacer un segundo
  // round-trip por línea.
  const catchWeightProductIds = products.filter((p) => p.isCatchWeight).map((p) => p.productId);

  const presentations = uniquePresentationIds.length || catchWeightProductIds.length
    ? await client.productPresentation.findMany({
        where: {
          OR: [
            ...(uniquePresentationIds.length ? [{ presentationId: { in: uniquePresentationIds } }] : []),
            ...(catchWeightProductIds.length
              ? [{ productId: { in: catchWeightProductIds }, isBase: true }]
              : []),
          ],
        },
        select: {
          presentationId: true,
          productId: true,
          name: true,
          factor: true,
          retailPrice: true,
          wholesalePrice: true,
          priceCurrencyId: true,
          isBase: true,
          isActive: true,
        },
      })
    : [];
  const presentationById = new Map(presentations.map((p) => [p.presentationId, p]));
  const basePresentationByProductId = new Map(
    presentations.filter((p) => p.isBase).map((p) => [p.productId, p])
  );

  let isWholesaleCustomer = false;
  const priceListItemByProductId = new Map<number, { price: Prisma.Decimal; currencyId: number | null }>();
  if (opts.customerId) {
    const customer = await client.customer.findUnique({
      where: { customerId: opts.customerId },
      select: { priceListId: true, customerType: true },
    });
    isWholesaleCustomer = customer?.customerType === "wholesale";
    if (customer?.priceListId) {
      const items = await client.priceListItem.findMany({
        where: { priceListId: customer.priceListId, productId: { in: uniqueProductIds } },
        select: { productId: true, price: true, currencyId: true },
      });
      for (const item of items) {
        priceListItemByProductId.set(item.productId, { price: item.price, currencyId: item.currencyId });
      }
    }
  }

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter((c): c is string => c != null))
  );

  const scopeConditions: Prisma.DiscountWhereInput[] = [
    { productId: { in: uniqueProductIds } },
    { productId: null, category: null },
  ];
  if (categories.length > 0) {
    scopeConditions.push({ productId: null, category: { in: categories } });
  }

  // Igual que getEffectivePrices pero SIN filtrar minQty en la query: cada
  // línea lo evalúa abajo con su propia cantidad en unidades base.
  const discounts = await client.discount.findMany({
    where: {
      isActive: true,
      OR: scopeConditions,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: at } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: at } }] },
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

  // pricePerBase (catch-weight) depende solo del producto, no de la línea:
  // se resuelve una vez por producto y se reutiliza en todas sus líneas.
  const pricePerBaseByProductId = new Map<number, number>();

  async function resolvePricePerBase(productId: number): Promise<number | undefined> {
    if (pricePerBaseByProductId.has(productId)) return pricePerBaseByProductId.get(productId);

    const product = productById.get(productId);
    if (!product?.isCatchWeight) return undefined;

    const basePresentation = basePresentationByProductId.get(productId);
    let rawPrice = product.salePrice != null ? Number(product.salePrice) : 0;
    let priceCurrencyId: number | null = product.saleCurrencyId;
    if (basePresentation) {
      rawPrice =
        isWholesaleCustomer && basePresentation.wholesalePrice != null
          ? Number(basePresentation.wholesalePrice)
          : Number(basePresentation.retailPrice);
      priceCurrencyId = basePresentation.priceCurrencyId;
    }

    const priceListItem = priceListItemByProductId.get(productId);
    if (priceListItem != null) {
      rawPrice = Number(priceListItem.price);
      priceCurrencyId = priceListItem.currencyId;
    }

    const rateApplied = await rateCache.rateFor(priceCurrencyId);
    const basePriceForKg = rateApplied != null ? rawPrice * rateApplied : rawPrice;

    const applicable = [
      ...(discountsByProductId.get(productId) ?? []),
      ...globalDiscounts,
      ...(product.category ? discountsByCategory.get(product.category) ?? [] : []),
    ].filter((d) => d.minQty == null || Number(d.minQty) <= 1);

    const resolved = resolvePriceFromDiscounts(basePriceForKg, applicable, base.decimalPlaces).finalPrice;
    pricePerBaseByProductId.set(productId, resolved);
    return resolved;
  }

  for (const line of lines) {
    const key = lineKey(line.productId, line.presentationId);
    if (results.has(key)) continue;

    const product = productById.get(line.productId);
    if (!product) continue; // Mismo criterio batch: ids inexistentes se omiten.

    let factor = 1;
    let isBasePresentation = true;
    let rawPrice = product.salePrice != null ? Number(product.salePrice) : 0;
    let priceCurrencyId: number | null = product.saleCurrencyId;

    if (line.presentationId != null) {
      const presentation = presentationById.get(line.presentationId);
      if (!presentation || presentation.productId !== line.productId) {
        throw new Error(
          `La presentación seleccionada no corresponde al producto ${line.productId}`
        );
      }
      if (!presentation.isActive) {
        throw new Error(`La presentación "${presentation.name}" está inactiva`);
      }
      factor = Number(presentation.factor);
      isBasePresentation = presentation.isBase;
      rawPrice =
        isWholesaleCustomer && presentation.wholesalePrice != null
          ? Number(presentation.wholesalePrice)
          : Number(presentation.retailPrice);
      priceCurrencyId = presentation.priceCurrencyId;
    }

    // La lista de precios del cliente gana solo sobre la presentación base;
    // las presentaciones no-base tienen su propio precio explícito.
    const priceListItem = priceListItemByProductId.get(line.productId);
    if (isBasePresentation && priceListItem != null) {
      rawPrice = Number(priceListItem.price);
      priceCurrencyId = priceListItem.currencyId;
    }

    const rateApplied = await rateCache.rateFor(priceCurrencyId);
    const basePrice = rateApplied != null ? rawPrice * rateApplied : rawPrice;

    const baseQty = toBaseQuantity(line.quantity, factor);
    const applicable = [
      ...(discountsByProductId.get(line.productId) ?? []),
      ...globalDiscounts,
      ...(product.category ? discountsByCategory.get(product.category) ?? [] : []),
    ].filter((d) => d.minQty == null || Number(d.minQty) <= baseQty);

    const pricePerBase = await resolvePricePerBase(line.productId);

    results.set(key, {
      ...resolvePriceFromDiscounts(basePrice, applicable, base.decimalPlaces),
      factor,
      priceCurrencyId,
      rateApplied,
      ...(pricePerBase !== undefined ? { pricePerBase } : {}),
    });
  }

  return results;
}
