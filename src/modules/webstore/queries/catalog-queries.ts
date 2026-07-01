import { db } from "@/lib/db";
import { getEffectivePrice } from "@/modules/inventory/lib/effective-price";

export type CatalogStatus = "all" | "enabled" | "hidden";

export interface CatalogFilters {
  search?: string;
  category?: string;
  status?: CatalogStatus;
  onlyOnSale?: boolean;
  onlyFeatured?: boolean;
}

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

export async function getWebstoreCatalog(filters: CatalogFilters = {}): Promise<CatalogRow[]> {
  const { search, category, status = "all", onlyOnSale, onlyFeatured } = filters;

  const products = await db.product.findMany({
    where: {
      isActive: true,
      ...(status === "enabled" && { webstoreEnabled: true }),
      ...(status === "hidden" && { webstoreEnabled: false }),
      ...(onlyFeatured && { webstoreFeatured: true }),
      ...(category && { category }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { sku: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    },
    include: {
      stockLevels: { select: { currentQuantity: true } },
      _count: { select: { discounts: { where: { isActive: true } } } },
    },
    orderBy: [{ webstoreFeatured: "desc" }, { name: "asc" }],
  });

  const rows = await Promise.all(
    products.map(async (p) => {
      const price = await getEffectivePrice(db, { productId: p.productId, quantity: 1 });
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
    })
  );

  return onlyOnSale ? rows.filter((r) => r.onSale) : rows;
}

export interface CatalogKpis {
  enabled: number;
  onSale: number;
  featured: number;
}

export async function getWebstoreCatalogKpis(): Promise<CatalogKpis> {
  const rows = await getWebstoreCatalog({ status: "enabled" });
  return {
    enabled: rows.length,
    onSale: rows.filter((r) => r.onSale).length,
    featured: rows.filter((r) => r.webstoreFeatured).length,
  };
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
