import { db } from "@/lib/db";

export interface ModelGroupMemberRow {
  productId: number;
  name: string;
  sku: string | null;
  modelLabel: string;
  modelSortOrder: number;
  webstoreEnabled: boolean;
  isActive: boolean;
  stockAvailable: number;
}

export interface ModelGroupRow {
  groupId: number;
  name: string;
  optionLabel: string;
  version: number;
  members: ModelGroupMemberRow[];
}

export async function listModelGroups(): Promise<ModelGroupRow[]> {
  const groups = await db.webstoreModelGroup.findMany({
    include: {
      products: {
        select: {
          productId: true,
          name: true,
          sku: true,
          modelLabel: true,
          modelSortOrder: true,
          webstoreEnabled: true,
          isActive: true,
          stockLevels: { select: { currentQuantity: true } },
        },
        orderBy: [{ modelSortOrder: "asc" }, { modelLabel: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  return groups.map((g) => ({
    groupId: g.groupId,
    name: g.name,
    optionLabel: g.optionLabel,
    version: g.version,
    members: g.products.map((p) => ({
      productId: p.productId,
      name: p.name,
      sku: p.sku,
      modelLabel: p.modelLabel ?? "",
      modelSortOrder: p.modelSortOrder,
      webstoreEnabled: p.webstoreEnabled,
      isActive: p.isActive,
      stockAvailable: p.stockLevels.reduce((sum, s) => sum + Number(s.currentQuantity), 0),
    })),
  }));
}
