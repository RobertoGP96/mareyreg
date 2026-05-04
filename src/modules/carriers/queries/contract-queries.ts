import { db } from "@/lib/db";

export async function getContracts(filters?: {
  driverId?: number;
  status?: "active" | "expired" | "cancelled";
  q?: string;
}) {
  const rows = await db.carrierContract.findMany({
    where: {
      ...(filters?.driverId && { driverId: filters.driverId }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.q && {
        OR: [
          { contractNo: { contains: filters.q, mode: "insensitive" } },
          { driver: { fullName: { contains: filters.q, mode: "insensitive" } } },
        ],
      }),
    },
    include: {
      driver: {
        select: {
          driverId: true,
          fullName: true,
          identificationNumber: true,
          entity: { select: { entityId: true, name: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });

  return rows.map((c) => ({
    contractId: c.contractId,
    driverId: c.driverId,
    driverName: c.driver.fullName,
    driverIdentification: c.driver.identificationNumber,
    entityName: c.driver.entity.name,
    contractNo: c.contractNo,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate?.toISOString() ?? null,
    status: c.status,
    fileUrl: c.fileUrl,
    fileName: c.fileName,
    fileMime: c.fileMime,
    fileSize: c.fileSize,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
}

export type ContractRow = Awaited<ReturnType<typeof getContracts>>[number];

export async function getContractById(contractId: number) {
  const c = await db.carrierContract.findUnique({
    where: { contractId },
    include: {
      driver: {
        select: {
          driverId: true,
          fullName: true,
          identificationNumber: true,
          phoneNumber: true,
          entity: { select: { entityId: true, name: true } },
        },
      },
    },
  });
  if (!c) return null;
  return {
    contractId: c.contractId,
    driverId: c.driverId,
    driverName: c.driver.fullName,
    driverIdentification: c.driver.identificationNumber,
    driverPhone: c.driver.phoneNumber,
    entityName: c.driver.entity.name,
    contractNo: c.contractNo,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate?.toISOString() ?? null,
    status: c.status,
    fileUrl: c.fileUrl,
    fileName: c.fileName,
    fileMime: c.fileMime,
    fileSize: c.fileSize,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export type ContractDetail = NonNullable<
  Awaited<ReturnType<typeof getContractById>>
>;

export async function getDriversForContract() {
  const rows = await db.driver.findMany({
    where: { status: "active" },
    select: {
      driverId: true,
      fullName: true,
      identificationNumber: true,
      entity: { select: { name: true } },
    },
    orderBy: { fullName: "asc" },
  });
  return rows.map((d) => ({
    driverId: d.driverId,
    fullName: d.fullName,
    identificationNumber: d.identificationNumber,
    entityName: d.entity.name,
  }));
}

export type ContractDriverOption = Awaited<
  ReturnType<typeof getDriversForContract>
>[number];
