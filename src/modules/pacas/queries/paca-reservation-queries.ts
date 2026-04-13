import { db } from "@/lib/db";

export async function getReservations() {
  return db.pacaReservation.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: { include: { classification: true } } },
  });
}

export async function getActiveReservations() {
  return db.pacaReservation.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    include: { category: { include: { classification: true } } },
  });
}
