import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiKey } from "@/modules/webstore/lib/api-key";
import { getEffectivePrice } from "@/modules/inventory/lib/effective-price";

export const runtime = "nodejs";

/**
 * Catálogo de solo lectura para la tienda en línea: productos habilitados,
 * con precio efectivo (ya con descuentos activos aplicados), stock disponible
 * y foto — así la tienda no necesita su propia fuente de verdad para precio,
 * inventario ni hosting de imágenes.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const rawKey = authHeader?.replace(/^Bearer\s+/i, "");
  if (!rawKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const apiKey = await resolveApiKey(rawKey);
  if (!apiKey) {
    return NextResponse.json({ error: "API key inválida o revocada" }, { status: 401 });
  }

  const products = await db.product.findMany({
    where: { webstoreEnabled: true, isActive: true },
    include: { stockLevels: { select: { currentQuantity: true } } },
    orderBy: [{ webstoreFeatured: "desc" }, { webstoreSortOrder: "asc" }, { name: "asc" }],
  });

  const catalog = await Promise.all(
    products.map(async (p) => {
      const price = await getEffectivePrice(db, { productId: p.productId, quantity: 1 });
      const stockAvailable = p.stockLevels.reduce((sum, s) => sum + Number(s.currentQuantity), 0);
      return {
        sku: p.sku,
        name: p.name,
        description: p.description,
        category: p.category,
        price: price.finalPrice,
        compareAtPrice: price.finalPrice < price.basePrice ? price.basePrice : null,
        featured: p.webstoreFeatured,
        stockAvailable,
        imageUrl: p.imageUrl,
      };
    })
  );

  return NextResponse.json(catalog);
}
