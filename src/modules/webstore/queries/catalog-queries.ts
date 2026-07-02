import { db } from "@/lib/db";
import { getEffectivePrices } from "@/modules/inventory/lib/effective-price";

export interface CatalogRow {
  productId: number;
  name: string;
  sku: string | null;
  category: string | null;
  imageUrl: string | null;
  isActive: boolean;
  webstoreEnabled: boolean;
  webstoreFeatured: boolean;
  webstoreSortOrder: number | null;
  salePrice: string | null;
  basePrice: number;
  finalPrice: number;
  onSale: boolean;
  discountCount: number;
  stockAvailable: number;
}

export interface CatalogKpis {
  enabled: number;
  onSale: number;
  featured: number;
}

export interface WebstoreCatalogResult {
  rows: CatalogRow[];
  kpis: CatalogKpis;
}

/**
 * Catálogo completo (todos los productos activos) más KPIs, calculados en
 * una sola pasada: los KPIs se derivan de las mismas filas ya cargadas en
 * vez de re-ejecutar la query del catálogo. El cliente (webstore-catalog-client)
 * recibe siempre el set completo y filtra en memoria, así que esta función
 * no expone parámetros de filtro server-side (search/category/status/onSale/
 * featured) — no tienen caller real hoy.
 */
export async function getWebstoreCatalogWithKpis(): Promise<WebstoreCatalogResult> {
  const products = await db.product.findMany({
    where: { isActive: true },
    include: {
      stockLevels: { select: { currentQuantity: true } },
      _count: { select: { discounts: { where: { isActive: true } } } },
    },
    orderBy: [{ webstoreFeatured: "desc" }, { name: "asc" }],
  });

  const prices = await getEffectivePrices(
    db,
    products.map((p) => p.productId),
    { quantity: 1 }
  );

  const rows: CatalogRow[] = products.map((p) => {
    const price = prices.get(p.productId) ?? { basePrice: 0, finalPrice: 0, appliedDiscounts: [] };
    const stockAvailable = p.stockLevels.reduce((sum, s) => sum + Number(s.currentQuantity), 0);
    return {
      productId: p.productId,
      name: p.name,
      sku: p.sku,
      category: p.category,
      imageUrl: p.imageUrl,
      isActive: p.isActive,
      webstoreEnabled: p.webstoreEnabled,
      webstoreFeatured: p.webstoreFeatured,
      webstoreSortOrder: p.webstoreSortOrder,
      salePrice: p.salePrice != null ? p.salePrice.toString() : null,
      basePrice: price.basePrice,
      finalPrice: price.finalPrice,
      onSale: price.finalPrice < price.basePrice,
      discountCount: p._count.discounts,
      stockAvailable,
    };
  });

  const enabledRows = rows.filter((r) => r.webstoreEnabled);
  const kpis: CatalogKpis = {
    enabled: enabledRows.length,
    onSale: enabledRows.filter((r) => r.onSale).length,
    featured: enabledRows.filter((r) => r.webstoreFeatured).length,
  };

  return { rows, kpis };
}

export interface ProductDiscountRow {
  discountId: number;
  name: string;
  type: string;
  value: string;
  minQty: string | null;
  startsAt: string | null;
  endsAt: string | null;
  stackable: boolean;
  isActive: boolean;
  version: number;
}

export async function getDiscountsByProduct(productId: number): Promise<ProductDiscountRow[]> {
  const rows = await db.discount.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((d) => ({
    discountId: d.discountId,
    name: d.name,
    type: String(d.type),
    value: d.value.toString(),
    minQty: d.minQty != null ? d.minQty.toString() : null,
    startsAt: d.startsAt ? d.startsAt.toISOString() : null,
    endsAt: d.endsAt ? d.endsAt.toISOString() : null,
    stackable: d.stackable,
    isActive: d.isActive,
    version: d.version,
  }));
}
