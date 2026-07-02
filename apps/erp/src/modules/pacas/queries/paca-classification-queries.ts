import { db } from "@/lib/db";

export async function getPacaClassifications() {
  const rows = await db.pacaClassification.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { categories: true } } },
  });
  return rows.map((r) => ({
    classificationId: r.classificationId,
    name: r.name,
    description: r.description,
    sortOrder: r.sortOrder,
    categoriesCount: r._count.categories,
    createdAt: r.createdAt,
  }));
}

export type PacaClassificationRow = Awaited<
  ReturnType<typeof getPacaClassifications>
>[number];
