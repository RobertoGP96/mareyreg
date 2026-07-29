import { db } from "@/lib/db";

export async function getPacaClients(activeOnly = true) {
  return db.pacaClient.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: { name: "asc" },
  });
}

export async function getPacaClient(id: number) {
  return db.pacaClient.findUnique({ where: { clientId: id } });
}

export async function getActivePacaClientsForPicker() {
  return db.pacaClient.findMany({
    where: { isActive: true },
    select: { clientId: true, name: true, phone: true, email: true },
    orderBy: { name: "asc" },
  });
}
