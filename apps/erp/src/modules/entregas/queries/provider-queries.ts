import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

export type ProviderRow = {
  providerId: number;
  name: string;
  active: boolean;
  deliveriesCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ListProvidersArgs = {
  search?: string;
  activeOnly?: boolean;
};

export async function listProviders(args: ListProvidersArgs = {}): Promise<ProviderRow[]> {
  const where: Prisma.DeliveryProviderWhereInput = {};
  if (args.activeOnly) where.active = true;
  if (args.search && args.search.trim().length > 0) {
    where.name = { contains: args.search.trim(), mode: "insensitive" };
  }

  const rows = await db.deliveryProvider.findMany({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { deliveries: true } } },
  });

  return rows.map((p) => ({
    providerId: p.providerId,
    name: p.name,
    active: p.active,
    deliveriesCount: p._count.deliveries,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

export type ProviderPickerOption = {
  providerId: number;
  name: string;
};

// Sin `take`: el picker filtra en cliente y un catálogo de proveedores es
// pequeño; un límite silencioso escondería opciones válidas.
export async function getProviderPickerOptions(): Promise<ProviderPickerOption[]> {
  return db.deliveryProvider.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { providerId: true, name: true },
  });
}
