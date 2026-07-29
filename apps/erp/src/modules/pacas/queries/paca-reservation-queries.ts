import { db } from "@/lib/db";
import { tryExpireOverdueReservations } from "@/modules/pacas/lib/reservation-expiration";

export async function getReservations() {
  await tryExpireOverdueReservations();
  return db.pacaReservation.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: { include: { classification: true } } },
  });
}

export async function getActiveReservations() {
  await tryExpireOverdueReservations();
  return db.pacaReservation.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    include: { category: { include: { classification: true } } },
  });
}
