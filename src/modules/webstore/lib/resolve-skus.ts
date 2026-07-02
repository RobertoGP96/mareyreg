import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;
type DbOrTx = PrismaTx | typeof db;

export interface ResolvedSku {
  productId: number;
  sku: string;
  isActive: boolean;
  webstoreEnabled: boolean;
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
 * Resuelve un lote de SKUs en una sola query (findMany con IN) en vez de un
 * findUnique por SKU. Devuelve un Map sku -> producto para los SKUs que sí
 * existen; los SKUs no encontrados simplemente no aparecen en el Map (y por
 * lo tanto se consideran no resueltos por los callers).
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

  return result;
}
