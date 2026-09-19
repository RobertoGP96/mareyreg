import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

export type RecipientRow = {
  recipientId: number;
  fullName: string;
  phone: string | null;
  address: string | null;
  mapUrl: string | null;
  active: boolean;
  deliveriesCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ListRecipientsArgs = {
  search?: string;
  activeOnly?: boolean;
};

export async function listRecipients(args: ListRecipientsArgs = {}): Promise<RecipientRow[]> {
  const where: Prisma.RecipientWhereInput = {};
  if (args.activeOnly) where.active = true;
  if (args.search && args.search.trim().length > 0) {
    const q = args.search.trim();
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await db.recipient.findMany({
    where,
    orderBy: [{ active: "desc" }, { fullName: "asc" }],
    include: { _count: { select: { deliveries: true } } },
  });

  return rows.map((r) => ({
    recipientId: r.recipientId,
    fullName: r.fullName,
    phone: r.phone,
    address: r.address,
    mapUrl: r.mapUrl,
    active: r.active,
    deliveriesCount: r._count.deliveries,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getRecipientById(id: number) {
  return db.recipient.findUnique({ where: { recipientId: id } });
}

export type RecipientPickerOption = {
  recipientId: number;
  fullName: string;
  phone: string | null;
  address: string | null;
};

export async function searchRecipientsForPicker(query: string): Promise<RecipientPickerOption[]> {
  const q = query.trim();
  const where: Prisma.RecipientWhereInput = { active: true };
  if (q.length > 0) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }
  const rows = await db.recipient.findMany({
    where,
    orderBy: { fullName: "asc" },
    take: 20,
    select: { recipientId: true, fullName: true, phone: true, address: true },
  });
  return rows;
}
