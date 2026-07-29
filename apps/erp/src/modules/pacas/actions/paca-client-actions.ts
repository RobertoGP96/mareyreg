"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { Prisma } from "@/generated/prisma";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

export interface PacaClientInput {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
}

const revalidateClientPaths = () => {
  revalidatePath("/pacas-clientes");
  revalidatePath("/pacas/reservaciones");
  revalidatePath("/pacas/ventas");
};

export async function createPacaClient(
  data: PacaClientInput
): Promise<ActionResult<{ clientId: number; name: string; phone: string | null; email: string | null }>> {
  try {
    const userId = await requireCurrentUserId();
    const client = await db.$transaction(async (tx) => {
      const c = await tx.pacaClient.create({
        data: {
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
          notes: data.notes || null,
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "PacaClient",
        entityId: c.clientId,
        module: "pacas",
        userId,
        newValues: data,
      });
      return c;
    });
    revalidateClientPaths();
    return {
      success: true,
      data: {
        clientId: client.clientId,
        name: client.name,
        phone: client.phone,
        email: client.email,
      },
    };
  } catch (error) {
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para crear un cliente" };
    }
    console.error("Error creating paca client:", error);
    return { success: false, error: "Error al crear el cliente" };
  }
}

export async function updatePacaClient(
  id: number,
  data: Partial<PacaClientInput> & { isActive?: boolean }
): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.pacaClient.findUnique({ where: { clientId: id } });
      await tx.pacaClient.update({
        where: { clientId: id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.phone !== undefined && { phone: data.phone || null }),
          ...(data.email !== undefined && { email: data.email || null }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "PacaClient",
        entityId: id,
        module: "pacas",
        userId,
        oldValues: prev,
        newValues: data,
      });
    });
    revalidateClientPaths();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para actualizar un cliente" };
    }
    console.error("Error updating paca client:", error);
    return { success: false, error: "Error al actualizar el cliente" };
  }
}

async function deletePacaClientInTx(
  tx: Prisma.TransactionClient,
  id: number,
  userId: number
): Promise<void> {
  const prev = await tx.pacaClient.findUnique({ where: { clientId: id } });
  if (!prev) {
    throw new Error("Cliente no encontrado");
  }
  // Soft-delete to preserve FK integrity on historical reservations/sales
  await tx.pacaClient.update({
    where: { clientId: id },
    data: { isActive: false },
  });
  await createAuditLog(tx, {
    action: "delete",
    entityType: "PacaClient",
    entityId: id,
    module: "pacas",
    userId,
    oldValues: prev,
  });
}

export async function deletePacaClients(
  ids: number[]
): Promise<ActionResult<{ deleted: number }>> {
  try {
    if (!ids.length) return { success: true, data: { deleted: 0 } };
    const userId = await requireCurrentUserId();

    const deleted = await db.$transaction(async (tx) => {
      for (const id of ids) {
        try {
          await deletePacaClientInTx(tx, id, userId);
        } catch (rowError) {
          const reason = rowError instanceof Error ? rowError.message : "error desconocido";
          throw new Error(`Fallo al eliminar el cliente #${id}: ${reason}`);
        }
      }
      return ids.length;
    });

    revalidateClientPaths();
    return { success: true, data: { deleted } };
  } catch (error) {
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para eliminar clientes" };
    }
    console.error("Error bulk delete clients:", error);
    const message =
      error instanceof Error ? error.message : "Error al desactivar clientes en lote";
    return { success: false, error: message };
  }
}

export async function deletePacaClient(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      await deletePacaClientInTx(tx, id, userId);
    });
    revalidateClientPaths();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para eliminar un cliente" };
    }
    console.error("Error deleting paca client:", error);
    return { success: false, error: "Error al eliminar el cliente" };
  }
}
