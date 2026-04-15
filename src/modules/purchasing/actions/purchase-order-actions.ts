"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";
import { nextFolio, DOC_TYPES } from "@/lib/folio";

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
    const userId = await getCurrentUserId();

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
    console.error("Error creating PO:", error);
    const msg = error instanceof Error ? error.message : "Error al crear la OC";
    return { success: false, error: msg };
  }
}

export async function updatePurchaseOrderStatus(
  poId: number,
  status: "draft" | "sent" | "cancelled"
): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
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
    console.error("Error updating PO status:", error);
    const msg = error instanceof Error ? error.message : "Error al actualizar la OC";
    return { success: false, error: msg };
  }
}

export async function deletePurchaseOrder(poId: number): Promise<ActionResult<void>> {
  try {
    const userId = await getCurrentUserId();
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
    console.error("Error deleting PO:", error);
    const msg = error instanceof Error ? error.message : "Error al eliminar la OC";
    return { success: false, error: msg };
  }
}
