"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";
import type { ActionResult } from "@/types";
import {
  CONTRACT_ACCEPTED_MIME,
  CONTRACT_MAX_BYTES,
  contractMetaSchema,
  contractStatusSchema,
  contractUpdateSchema,
  isContractMime,
  type ContractStatus,
} from "../lib/schemas";

const revalidateAll = () => {
  revalidatePath("/contracts");
  revalidatePath("/drivers");
};

function parseDate(input?: string | null): Date | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export type CreateContractInput = {
  driverId: number;
  contractNo: string;
  startDate: string;
  endDate?: string | null;
  status?: ContractStatus;
  notes?: string | null;
  fileUrl: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
};

/**
 * Persiste la metadata del contrato. El archivo ya fue subido a Vercel Blob
 * desde el cliente vía `@vercel/blob/client` `upload()` apuntando a
 * `/api/contracts/upload`. Si la DB falla, se elimina el blob para no dejar
 * archivos huérfanos.
 */
export async function createContract(
  input: CreateContractInput
): Promise<ActionResult<{ contractId: number; fileUrl: string }>> {
  try {
    const parsed = contractMetaSchema.safeParse({
      driverId: input.driverId,
      contractNo: input.contractNo,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status ?? "active",
      notes: input.notes,
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;

    if (!input.fileUrl) {
      return { success: false, error: "Falta la URL del archivo" };
    }
    if (!input.fileSize || input.fileSize <= 0) {
      return { success: false, error: "Archivo inválido" };
    }
    if (input.fileSize > CONTRACT_MAX_BYTES) {
      return { success: false, error: "El archivo supera 10 MB" };
    }
    if (!isContractMime(input.fileMime)) {
      return {
        success: false,
        error: `Tipo no soportado. Usa: ${CONTRACT_ACCEPTED_MIME.join(", ")}`,
      };
    }

    const startDate = parseDate(data.startDate);
    if (!startDate) return { success: false, error: "Fecha de inicio inválida" };
    const endDate = data.endDate ? parseDate(data.endDate) : null;
    if (data.endDate && !endDate) {
      return { success: false, error: "Fecha de fin inválida" };
    }
    if (endDate && endDate < startDate) {
      return { success: false, error: "Fecha de fin no puede ser anterior al inicio" };
    }

    const driver = await db.driver.findUnique({
      where: { driverId: data.driverId },
      select: { driverId: true, fullName: true, status: true },
    });
    if (!driver) {
      await safeDelBlob(input.fileUrl);
      return { success: false, error: "Conductor no encontrado" };
    }

    const dup = await db.carrierContract.findUnique({
      where: {
        driverId_contractNo: {
          driverId: data.driverId,
          contractNo: data.contractNo,
        },
      },
      select: { contractId: true },
    });
    if (dup) {
      await safeDelBlob(input.fileUrl);
      return {
        success: false,
        error: `Ya existe un contrato con folio ${data.contractNo} para este conductor`,
      };
    }

    const userId = await getCurrentUserId();

    try {
      const created = await db.$transaction(async (tx) => {
        const c = await tx.carrierContract.create({
          data: {
            driverId: data.driverId,
            contractNo: data.contractNo,
            startDate,
            endDate,
            status: data.status,
            fileUrl: input.fileUrl,
            fileName: input.fileName,
            fileMime: input.fileMime,
            fileSize: input.fileSize,
            notes: data.notes?.trim() || null,
            createdById: userId ?? null,
          },
        });
        await createAuditLog(tx, {
          action: "create",
          entityType: "CarrierContract",
          entityId: c.contractId,
          module: "logistics",
          userId,
          newValues: {
            driverId: data.driverId,
            contractNo: data.contractNo,
            status: data.status,
            fileName: input.fileName,
          },
        });
        return c;
      });

      revalidateAll();
      return {
        success: true,
        data: { contractId: created.contractId, fileUrl: input.fileUrl },
      };
    } catch (dbError) {
      await safeDelBlob(input.fileUrl);
      throw dbError;
    }
  } catch (error) {
    console.error("createContract:", error);
    return { success: false, error: "Error al guardar el contrato" };
  }
}

async function safeDelBlob(url: string) {
  try {
    await del(url);
  } catch (cleanupError) {
    console.error("Error eliminando blob:", cleanupError);
  }
}

export async function updateContract(
  contractId: number,
  input: {
    contractNo?: string;
    startDate?: string;
    endDate?: string | null;
    status?: ContractStatus;
    notes?: string | null;
  }
): Promise<ActionResult<void>> {
  try {
    const parsed = contractUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const data = parsed.data;

    const current = await db.carrierContract.findUnique({
      where: { contractId },
    });
    if (!current) return { success: false, error: "Contrato no encontrado" };

    let startDate: Date | undefined;
    if (data.startDate) {
      const parsed = parseDate(data.startDate);
      if (!parsed) return { success: false, error: "Fecha de inicio inválida" };
      startDate = parsed;
    }
    let endDate: Date | null | undefined;
    if (data.endDate === null) {
      endDate = null;
    } else if (data.endDate) {
      const parsed = parseDate(data.endDate);
      if (!parsed) return { success: false, error: "Fecha de fin inválida" };
      endDate = parsed;
    }
    const finalStart = startDate ?? current.startDate;
    const finalEnd = endDate === undefined ? current.endDate : endDate;
    if (finalEnd && finalEnd < finalStart) {
      return { success: false, error: "Fecha de fin no puede ser anterior al inicio" };
    }

    if (data.contractNo && data.contractNo !== current.contractNo) {
      const dup = await db.carrierContract.findUnique({
        where: {
          driverId_contractNo: {
            driverId: current.driverId,
            contractNo: data.contractNo,
          },
        },
        select: { contractId: true },
      });
      if (dup && dup.contractId !== contractId) {
        return { success: false, error: `Ya existe un contrato con folio ${data.contractNo}` };
      }
    }

    const userId = await getCurrentUserId();

    await db.$transaction(async (tx) => {
      await tx.carrierContract.update({
        where: { contractId },
        data: {
          ...(data.contractNo !== undefined && { contractNo: data.contractNo }),
          ...(startDate !== undefined && { startDate }),
          ...(endDate !== undefined && { endDate }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "CarrierContract",
        entityId: contractId,
        module: "logistics",
        userId,
        oldValues: {
          contractNo: current.contractNo,
          status: current.status,
        },
        newValues: data,
      });
    });

    revalidateAll();
    revalidatePath(`/contracts/${contractId}`);
    return { success: true, data: undefined };
  } catch (error) {
    console.error("updateContract:", error);
    return { success: false, error: "Error al actualizar el contrato" };
  }
}

export async function setContractStatus(
  contractId: number,
  status: ContractStatus
): Promise<ActionResult<void>> {
  const parsed = contractStatusSchema.safeParse(status);
  if (!parsed.success) return { success: false, error: "Estado inválido" };
  return updateContract(contractId, { status: parsed.data });
}

export async function deleteContract(
  contractId: number
): Promise<ActionResult<void>> {
  try {
    const current = await db.carrierContract.findUnique({
      where: { contractId },
    });
    if (!current) return { success: false, error: "Contrato no encontrado" };

    const userId = await getCurrentUserId();

    await db.$transaction(async (tx) => {
      await tx.carrierContract.delete({ where: { contractId } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "CarrierContract",
        entityId: contractId,
        module: "logistics",
        userId,
        oldValues: {
          driverId: current.driverId,
          contractNo: current.contractNo,
          fileName: current.fileName,
        },
      });
    });

    try {
      await del(current.fileUrl);
    } catch (blobError) {
      console.error("Error eliminando blob:", blobError);
    }

    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    console.error("deleteContract:", error);
    return { success: false, error: "Error al eliminar el contrato" };
  }
}
