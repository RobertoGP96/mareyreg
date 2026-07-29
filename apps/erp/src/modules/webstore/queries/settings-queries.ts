import { db } from "@/lib/db";
import type { LocationType } from "@/generated/prisma";
import { getDefaultWebstoreWarehouseId } from "../lib/dispatch-warehouse";

export interface WebstoreWarehouseOption {
  warehouseId: number;
  name: string;
  location: string | null;
  locationType: LocationType;
}

export interface WebstoreSettingsData {
  configuredWarehouseId: number | null;
  // Configurado pero inactivo — la tienda está operando con el fallback.
  configuredWarehouseInactive: boolean;
  effectiveWarehouse: { warehouseId: number; name: string } | null;
  warehouses: WebstoreWarehouseOption[];
}

export async function getWebstoreSettings(): Promise<WebstoreSettingsData> {
  const [company, warehouses, effectiveWarehouseId] = await Promise.all([
    db.company.findUnique({
      where: { id: 1 },
      select: {
        webstoreWarehouseId: true,
        webstoreWarehouse: { select: { isActive: true } },
      },
    }),
    db.warehouse.findMany({
      where: { isActive: true },
      select: { warehouseId: true, name: true, location: true, locationType: true },
      orderBy: { name: "asc" },
    }),
    getDefaultWebstoreWarehouseId(db),
  ]);

  const effectiveWarehouse =
    effectiveWarehouseId != null
      ? await db.warehouse.findUnique({
          where: { warehouseId: effectiveWarehouseId },
          select: { warehouseId: true, name: true },
        })
      : null;

  return {
    configuredWarehouseId: company?.webstoreWarehouseId ?? null,
    configuredWarehouseInactive:
      company?.webstoreWarehouseId != null && company.webstoreWarehouse?.isActive === false,
    effectiveWarehouse,
    warehouses,
  };
}
