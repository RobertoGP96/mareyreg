import { db } from "@/lib/db";

export async function getEntities() {
  return db.entity.findMany({ orderBy: { name: "asc" } });
}

export async function getEntity(id: number) {
  return db.entity.findUnique({ where: { entityId: id } });
}

export async function getEntityWithDrivers(id: number) {
  return db.entity.findUnique({
    where: { entityId: id },
    include: { drivers: { orderBy: { fullName: "asc" } } },
  });
}
