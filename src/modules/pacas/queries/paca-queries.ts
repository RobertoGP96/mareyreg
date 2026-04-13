import { db } from "@/lib/db";

export async function getPacas() {
  return db.paca.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: true, warehouse: true },
  });
}

export async function getPaca(id: number) {
  return db.paca.findUnique({
    where: { pacaId: id },
    include: { category: true, warehouse: true },
  });
}

export async function getPacasStats() {
  const [total, available, sold, inTransit] = await Promise.all([
    db.paca.count(),
    db.paca.count({ where: { status: "available" } }),
    db.paca.count({ where: { status: "sold" } }),
    db.paca.count({ where: { status: "in_transit" } }),
  ]);
  return { total, available, sold, inTransit };
}
