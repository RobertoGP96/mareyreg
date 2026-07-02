import { db } from "@/lib/db";

export async function getPacaCategories() {
  return db.pacaCategory.findMany({
    orderBy: { name: "asc" },
    include: { classification: true },
  });
}

export async function getPacaCategory(id: number) {
  return db.pacaCategory.findUnique({
    where: { categoryId: id },
    include: { classification: true },
  });
}
