"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { nextFolio, DOC_TYPES } from "@/lib/folio";
import { toBaseQuantity } from "@/modules/inventory/lib/units";
import { getBaseCurrency, getRateToBase, GlobalRateNotConfiguredError } from "@/lib/currency";
import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

const BUSINESS_ERRORS = new Set([
  "OC no encontrada",
  "No se puede cambiar el estado de una OC ya recibida",
  "No se puede eliminar una OC con recepciones",
]);

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof GlobalRateNotConfiguredError) return error.message;
  if (error instanceof Error) {
    if (BUSINESS_ERRORS.has(error.message)) return error.message;
    if (error.message.startsWith("La presentación")) return error.message;
    if (error.message.startsWith("El producto")) return error.message;
  }
  return fallback;
}

export interface POLineInput {
  productId: number;
  quantity: number;
  unitCost: number;
  presentationId?: number;
}

interface ResolvedLinePresentation {
  presentationId: number | null;
  unitFactor: number;
  baseQuantity: number;
}

/**
 * Valida server-side la presentación de una línea de OC (pertenece al
 * producto, está activa) y calcula el snapshot que se guarda en la línea:
 * el factor nunca se toma del caller, siempre se lee de la BD en el momento
 * de crear la OC (igual que resolvePresentation en stock-actions.ts).
 *
 * Productos catch-weight: la OC se captura siempre en una presentación con
 * piezas (Pieza/Caja), nunca en la unidad base (kg) — el peso real se
 * conoce hasta la recepción. quantity debe ser entera (cajas/piezas
 * pedidas); baseQuantity aquí es solo una ESTIMACION con el factor nominal,
 * la recepción la recalcula con el peso real capturado en báscula.
 */
async function resolveLinePresentation(
  tx: PrismaTx,
  params: { productId: number; presentationId?: number; quantity: number }
): Promise<ResolvedLinePresentation> {
  const { productId, presentationId, quantity } = params;

  const product = await tx.product.findUnique({
    where: { productId },
    select: { isCatchWeight: true },
  });
  if (!product) {
    throw new Error(`El producto ${productId} no existe`);
  }

  if (presentationId == null) {
    if (product.isCatchWeight) {
      throw new Error(
        `El producto es de peso variable: selecciona una presentación con piezas (no la unidad base)`
      );
    }
    return { presentationId: null, unitFactor: 1, baseQuantity: quantity };
  }

  const presentation = await tx.productPresentation.findUnique({
    where: { presentationId },
  });
  if (!presentation || presentation.productId !== productId) {
    throw new Error(
      `La presentación seleccionada no corresponde al producto ${productId}`
    );
  }
  if (!presentation.isActive) {
    throw new Error(`La presentación "${presentation.name}" está inactiva`);
  }

  if (product.isCatchWeight) {
    if (presentation.piecesPerUnit == null) {
      throw new Error(
        `El producto es de peso variable: la presentación "${presentation.name}" no tiene piezas configuradas`
      );
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(
        `El producto es de peso variable: la cantidad debe ser un entero (cajas/piezas)`
      );
    }
  }

  const unitFactor = Number(presentation.factor);
  const baseQuantity = toBaseQuantity(quantity, unitFactor);

  return { presentationId: presentation.presentationId, unitFactor, baseQuantity };
}

export interface POInput {
  supplierId: number;
  warehouseId: number;
  orderDate: string; // ISO
  expectedDate?: string;
  notes?: string;
  lines: POLineInput[];
  currencyId?: number; // omitido o = moneda base -> documento en CUP, sin snapshot
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

      // Moneda del documento: si se omite o coincide con la base, el
      // documento queda en CUP y los campos *Base quedan null (convención
      // "null moneda = base" ya usada en Fase 1).
      const base = await getBaseCurrency(tx);
      const isBaseCurrency = !data.currencyId || data.currencyId === base.currencyId;
      let currencyId: number | null = null;
      let exchangeRate: number | null = null;
      let subtotalBase: number | null = null;
      let totalBase: number | null = null;
      if (!isBaseCurrency) {
        const snapshot = await getRateToBase(tx, data.currencyId!);
        currencyId = data.currencyId!;
        exchangeRate = snapshot.rate;
        subtotalBase = subtotal * snapshot.rate;
        totalBase = total * snapshot.rate;
      }

      const resolvedLines = await Promise.all(
        data.lines.map(async (l) => {
          const { presentationId, unitFactor, baseQuantity } = await resolveLinePresentation(tx, {
            productId: l.productId,
            presentationId: l.presentationId,
            quantity: l.quantity,
          });
          return {
            productId: l.productId,
            quantity: l.quantity,
            unitCost: l.unitCost,
            presentationId,
            unitFactor,
            baseQuantity,
          };
        })
      );

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
          currencyId,
          exchangeRate,
          subtotalBase,
          totalBase,
          notes: data.notes || null,
          createdBy: userId,
          lines: {
            create: resolvedLines,
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
