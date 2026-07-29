import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;
type DbOrTx = PrismaTx | typeof db;

export interface ResolvedSku {
  productId: number;
  sku: string;
  isActive: boolean;
  webstoreEnabled: boolean;
  /** Presente cuando el SKU resuelto es una presentación (no la base del producto). */
  presentationId?: number;
}

/**
 * Un SKU se considera "resuelto" (disponible para despacho vía tienda en
 * línea) si el producto existe, está activo y tiene webstoreEnabled=true.
 * Único criterio de verdad, compartido entre processWebstoreOrder (decide si
 * la orden se procesa o va a needs_review) y la página de detalle de orden
 * (solo muestra el estado). No cubre la resolución por productId con
 * override manual de process-order.ts, que es una ruta distinta.
 */
export function isSkuResolved(product: { isActive: boolean; webstoreEnabled: boolean }): boolean {
  return product.isActive && product.webstoreEnabled;
}

/**
 * Resuelve un lote de SKUs en dos queries batch (productos + presentaciones,
 * cada una con un IN) en vez de un findUnique por SKU. Devuelve un Map
 * sku -> producto/presentación para los SKUs que sí existen; los SKUs no
 * encontrados simplemente no aparecen en el Map (y por lo tanto se consideran
 * no resueltos por los callers).
 *
 * Si un mismo SKU existe tanto en `products` como en `product_presentations`
 * (no debería pasar por los `@unique` de schema, pero no hay constraint
 * cross-tabla que lo impida), gana el producto: se resuelve primero el Map de
 * productos y luego se insertan las presentaciones solo si la key aún no
 * existe. Orden determinista y documentado en vez de dejarlo al azar del
 * orden de queries.
 */
export async function resolveSkusBatch(
  client: DbOrTx,
  skus: string[]
): Promise<Map<string, ResolvedSku>> {
  const uniqueSkus = Array.from(new Set(skus));
  const result = new Map<string, ResolvedSku>();
  if (uniqueSkus.length === 0) return result;

  const products = await client.product.findMany({
    where: { sku: { in: uniqueSkus } },
    select: { productId: true, sku: true, isActive: true, webstoreEnabled: true },
  });

  for (const p of products) {
    if (p.sku == null) continue;
    result.set(p.sku, {
      productId: p.productId,
      sku: p.sku,
      isActive: p.isActive,
      webstoreEnabled: p.webstoreEnabled,
    });
  }

  const remainingSkus = uniqueSkus.filter((sku) => !result.has(sku));
  if (remainingSkus.length > 0) {
    const presentations = await client.productPresentation.findMany({
      where: { sku: { in: remainingSkus } },
      select: {
        presentationId: true,
        sku: true,
        isActive: true,
        product: { select: { productId: true, isActive: true, webstoreEnabled: true } },
      },
    });

    for (const p of presentations) {
      if (p.sku == null || result.has(p.sku)) continue;
      // La presentación solo es resoluble si el producto padre cumple el
      // criterio de la tienda Y la presentación misma está activa. isActive
      // aquí refleja AMBAS condiciones (ver isSkuResolved: solo evalúa
      // isActive/webstoreEnabled, que ya vienen combinados).
      result.set(p.sku, {
        productId: p.product.productId,
        sku: p.sku,
        isActive: p.product.isActive && p.isActive,
        webstoreEnabled: p.product.webstoreEnabled,
        presentationId: p.presentationId,
      });
    }
  }

  return result;
}
