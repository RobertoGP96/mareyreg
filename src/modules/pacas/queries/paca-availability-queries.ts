import { db } from "@/lib/db";

export interface AvailabilityItem {
  classificationName: string;
  classificationId: number;
  categoryName: string;
  categoryId: number;
  available: number;
  reserved: number;
  sold: number;
  total: number;
}

export async function getAvailabilityByClassification(): Promise<
  { classification: string; classificationId: number; categories: { name: string; categoryId: number; available: number; reserved: number; sold: number; total: number }[] }[]
> {
  const classifications = await db.pacaClassification.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      categories: {
        orderBy: { name: "asc" },
        include: {
          pacas: {
            select: { status: true },
          },
        },
      },
    },
  });

  return classifications.map((cls) => ({
    classification: cls.name,
    classificationId: cls.classificationId,
    categories: cls.categories.map((cat) => {
      const available = cat.pacas.filter((p) => p.status === "available").length;
      const reserved = cat.pacas.filter((p) => p.status === "reserved").length;
      const sold = cat.pacas.filter((p) => p.status === "sold").length;
      const total = cat.pacas.length;
      return {
        name: cat.name,
        categoryId: cat.categoryId,
        available,
        reserved,
        sold,
        total,
      };
    }),
  }));
}

export async function getClassifications() {
  return db.pacaClassification.findMany({
    orderBy: { sortOrder: "asc" },
  });
}
