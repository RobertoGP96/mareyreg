import { db } from "@/lib/db";

export interface ProductPresentationRow {
  presentationId: number;
  productId: number;
  name: string;
  factor: number;
  /** Piezas fungibles por unidad (catch-weight). null en la base y en productos normales. */
  piecesPerUnit: number | null;
  sku: string | null;
  barcode: string | null;
  retailPrice: number;
  wholesalePrice: number | null;
  /** null = moneda base (CUP). */
  priceCurrencyId: number | null;
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
    piecesPerUnit: r.piecesPerUnit ?? null,
    sku: r.sku,
    barcode: r.barcode,
    retailPrice: Number(r.retailPrice),
    wholesalePrice: r.wholesalePrice != null ? Number(r.wholesalePrice) : null,
    priceCurrencyId: r.priceCurrencyId,
    isBase: r.isBase,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
  }));
}
