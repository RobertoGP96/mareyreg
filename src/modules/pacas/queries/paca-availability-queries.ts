import { db } from "@/lib/db";

export async function getAvailabilityByClassification() {
  const classifications = await db.pacaClassification.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      categories: {
        orderBy: { name: "asc" },
        include: { inventory: true },
      },
    },
  });

  return classifications.map((cls) => ({
    classification: cls.name,
    classificationId: cls.classificationId,
    categories: cls.categories.map((cat) => {
      const available = cat.inventory?.available ?? 0;
      const reserved = cat.inventory?.reserved ?? 0;
      const sold = cat.inventory?.sold ?? 0;
      return {
        name: cat.name,
        categoryId: cat.categoryId,
        available,
        reserved,
        sold,
        total: available + reserved + sold,
      };
    }),
  }));
}

export async function getClassifications() {
  return db.pacaClassification.findMany({
    orderBy: { sortOrder: "asc" },
  });
}
