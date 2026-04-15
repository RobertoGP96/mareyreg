"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";

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
    const userId = await getCurrentUserId();
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
    console.error("Error creating paca client:", error);
    return { success: false, error: "Error al crear el cliente" };
  }
}

export async function updatePacaClient(
  id: number,
  data: Partial<PacaClientInput> & { isActive?: boolean }
): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
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
    console.error("Error updating paca client:", error);
    return { success: false, error: "Error al actualizar el cliente" };
  }
}

export async function deletePacaClient(id: number): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.pacaClient.findUnique({ where: { clientId: id } });
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
    });
    revalidateClientPaths();
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting paca client:", error);
    return { success: false, error: "Error al eliminar el cliente" };
  }
}
