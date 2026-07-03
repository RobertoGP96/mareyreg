import { db } from "@/lib/db";
import { getEffectivePrices } from "@/modules/inventory/lib/effective-price";

export interface OfferProductRow {
  productId: number;
  name: string;
  sku: string | null;
}

export interface OfferRow {
  offerId: number;
  name: string;
  description: string | null;
  type: string;
  value: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  version: number;
  createdAt: string;
  products: OfferProductRow[];
}

export interface OfferKpis {
  active: number;
  endingSoon: number;
  productsOnOffer: number;
}

const ENDING_SOON_DAYS = 7;

export async function listOffers(): Promise<OfferRow[]> {
  const offers = await db.webstoreOffer.findMany({
    include: {
      discounts: {
        include: { product: { select: { productId: true, name: true, sku: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return offers.map((o) => ({
    offerId: o.offerId,
    name: o.name,
    description: o.description,
    type: String(o.type),
    value: o.value.toString(),
    startsAt: o.startsAt ? o.startsAt.toISOString() : null,
    endsAt: o.endsAt ? o.endsAt.toISOString() : null,
    isActive: o.isActive,
    version: o.version,
    createdAt: o.createdAt.toISOString(),
    products: o.discounts
      .filter((d) => d.product != null)
      .map((d) => ({
        productId: d.product!.productId,
        name: d.product!.name,
        sku: d.product!.sku,
      })),
  }));
}

export async function getOfferKpis(): Promise<OfferKpis> {
  const now = new Date();
  const soon = new Date(now.getTime() + ENDING_SOON_DAYS * 24 * 60 * 60 * 1000);

  const offers = await db.webstoreOffer.findMany({
    where: { isActive: true },
    include: { _count: { select: { discounts: true } } },
  });

  const active = offers.length;
  const endingSoon = offers.filter((o) => o.endsAt != null && o.endsAt <= soon && o.endsAt >= now).length;
  const productsOnOffer = offers.reduce((sum, o) => sum + o._count.discounts, 0);

  return { active, endingSoon, productsOnOffer };
}

export interface OfferHistoryRow {
  historyId: number;
  discountId: number | null;
  productId: number | null;
  productName: string | null;
  action: string;
  oldValues: unknown;
  newValues: unknown;
  changedByName: string | null;
  changedAt: string;
}

/**
 * Historial de los descuentos espejo de la oferta, por productId (igual
 * criterio que `getDiscountHistory` de inventario): así se conserva el
 * historial aunque el discount espejo ya se haya eliminado (offerId se
 * pierde, pero productId y el registro persisten).
 */
export async function getOfferHistory(offerId: number): Promise<OfferHistoryRow[]> {
  const offer = await db.webstoreOffer.findUnique({
    where: { offerId },
    include: { discounts: { select: { productId: true } } },
  });
  if (!offer) return [];

  const productIds = offer.discounts
    .map((d) => d.productId)
    .filter((id): id is number => id != null);
  if (productIds.length === 0) return [];

  const rows = await db.discountHistory.findMany({
    where: { productId: { in: productIds } },
    include: {
      product: { select: { name: true } },
      changedByUser: { select: { fullName: true } },
    },
    orderBy: { changedAt: "desc" },
  });

  return rows.map((h) => ({
    historyId: h.historyId,
    discountId: h.discountId,
    productId: h.productId,
    productName: h.product?.name ?? null,
    action: String(h.action),
    oldValues: h.oldValues,
    newValues: h.newValues,
    changedByName: h.changedByUser?.fullName ?? null,
    changedAt: h.changedAt.toISOString(),
  }));
}

export interface WebstoreProductPickerRow {
  productId: number;
  name: string;
  sku: string | null;
  category: string | null;
  imageUrl: string | null;
  currentPrice: number;
  hasManualDiscount: boolean;
}

export async function listWebstoreProductsForPicker(): Promise<WebstoreProductPickerRow[]> {
  const products = await db.product.findMany({
    where: { webstoreEnabled: true, isActive: true },
    select: {
      productId: true,
      name: true,
      sku: true,
      category: true,
      imageUrl: true,
      discounts: { where: { isActive: true, offerId: null }, select: { discountId: true } },
    },
    orderBy: { name: "asc" },
  });

  const prices = await getEffectivePrices(
    db,
    products.map((p) => p.productId),
    { quantity: 1 }
  );

  return products.map((p) => ({
    productId: p.productId,
    name: p.name,
    sku: p.sku,
    category: p.category,
    imageUrl: p.imageUrl,
    currentPrice: prices.get(p.productId)?.basePrice ?? 0,
    hasManualDiscount: p.discounts.length > 0,
  }));
}
