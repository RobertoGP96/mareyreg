"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { nextFolio, DOC_TYPES } from "@/lib/folio";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

const BUSINESS_ERRORS = new Set([
  "OC no encontrada",
  "No se puede cambiar el estado de una OC ya recibida",
  "No se puede eliminar una OC con recepciones",
]);

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && BUSINESS_ERRORS.has(error.message)) {
    return error.message;
  }
  return fallback;
}

export interface POLineInput {
  productId: number;
  quantity: number;
  unitCost: number;
}

export interface POInput {
  supplierId: number;
  warehouseId: number;
  orderDate: string; // ISO
  expectedDate?: string;
  notes?: string;
  lines: POLineInput[];
}

function calcTotals(lines: POLineInput[]) {
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  return { subtotal, total: subtotal };
}

export async function createPurchaseOrder(
  data: POInput
): Promise<ActionResult<{ poId: number; folio: string }>> {
  try {
    if (!data.lines.length) {
      return { success: false, error: "La OC debe tener al menos una linea" };
    }
    for (const l of data.lines) {
      if (l.quantity <= 0) return { success: false, error: "Las cantidades deben ser mayores a 0" };
      if (l.unitCost < 0) return { success: false, error: "El costo no puede ser negativo" };
    }

    const { subtotal, total } = calcTotals(data.lines);
    const userId = await requireCurrentUserId();

    const po = await db.$transaction(async (tx) => {
      const folio = await nextFolio(tx, DOC_TYPES.PURCHASE_ORDER);
      const created = await tx.purchaseOrder.create({
        data: {
          folio,
          supplierId: data.supplierId,
          warehouseId: data.warehouseId,
          status: "draft",
          orderDate: new Date(data.orderDate),
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          subtotal,
          total,
          notes: data.notes || null,
          createdBy: userId,
          lines: {
            create: data.lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitCost: l.unitCost,
            })),
          },
        },
      });
      await createAuditLog(tx, {
        action: "create",
        entityType: "PurchaseOrder",
        entityId: created.poId,
        module: "purchasing",
        userId,
        newValues: { folio, ...data },
      });
      return created;
    });

    revalidatePath("/purchase-orders");
    return { success: true, data: { poId: po.poId, folio: po.folio } };
  } catch (error) {
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para crear una OC" };
    }
    console.error("Error creating PO:", error);
    return { success: false, error: toUserMessage(error, "Error al crear la OC") };
  }
}

export async function updatePurchaseOrderStatus(
  poId: number,
  status: "draft" | "sent" | "cancelled"
): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.purchaseOrder.findUnique({ where: { poId } });
      if (!prev) throw new Error("OC no encontrada");
      if (prev.status === "received" || prev.status === "partial") {
        throw new Error("No se puede cambiar el estado de una OC ya recibida");
      }
      await tx.purchaseOrder.update({ where: { poId }, data: { status } });
      await createAuditLog(tx, {
        action: "update",
        entityType: "PurchaseOrder",
        entityId: poId,
        module: "purchasing",
        userId,
        oldValues: { status: prev.status },
        newValues: { status },
      });
    });
    revalidatePath("/purchase-orders");
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para actualizar una OC" };
    }
    console.error("Error updating PO status:", error);
    return { success: false, error: toUserMessage(error, "Error al actualizar la OC") };
  }
}

export async function deletePurchaseOrder(poId: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await db.$transaction(async (tx) => {
      const prev = await tx.purchaseOrder.findUnique({
        where: { poId },
        include: { receipts: true },
      });
      if (!prev) throw new Error("OC no encontrada");
      if (prev.receipts.length) throw new Error("No se puede eliminar una OC con recepciones");
      await tx.purchaseOrder.delete({ where: { poId } });
      await createAuditLog(tx, {
        action: "delete",
        entityType: "PurchaseOrder",
        entityId: poId,
        module: "purchasing",
        userId,
        oldValues: prev,
      });
    });
    revalidatePath("/purchase-orders");
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para eliminar una OC" };
    }
    console.error("Error deleting PO:", error);
    return { success: false, error: toUserMessage(error, "Error al eliminar la OC") };
  }
}
