import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;
type DbOrTx = PrismaTx | typeof db;

/**
 * Único punto de verdad para elegir el almacén de despacho de la tienda en
 * línea cuando la orden no especifica uno explícito. El catálogo público
 * (products/route.ts) y el despacho real (process-order.ts) deben usar
 * siempre este mismo criterio — de lo contrario el stock mostrado al cliente
 * puede no coincidir con el almacén del que en realidad se descuenta.
 */
export async function getDefaultWebstoreWarehouseId(client: DbOrTx): Promise<number | null> {
  const defaultWarehouse = await client.warehouse.findFirst({
    where: { isActive: true },
    orderBy: { warehouseId: "asc" },
    select: { warehouseId: true },
  });
  return defaultWarehouse?.warehouseId ?? null;
}
