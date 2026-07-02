import { db } from "@/lib/db";

export interface ProductPresentationRow {
  presentationId: number;
  productId: number;
  name: string;
  factor: number;
  sku: string | null;
  barcode: string | null;
  retailPrice: number;
  wholesalePrice: number | null;
  isBase: boolean;
  isActive: boolean;
  sortOrder: number;
}

export async function getProductPresentations(productId: number): Promise<ProductPresentationRow[]> {
  const rows = await db.productPresentation.findMany({
    where: { productId },
    orderBy: [{ isBase: "desc" }, { sortOrder: "asc" }],
  });

  return rows.map((r) => ({
    presentationId: r.presentationId,
    productId: r.productId,
    name: r.name,
    factor: Number(r.factor),
    sku: r.sku,
    barcode: r.barcode,
    retailPrice: Number(r.retailPrice),
    wholesalePrice: r.wholesalePrice != null ? Number(r.wholesalePrice) : null,
    isBase: r.isBase,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
  }));
}
