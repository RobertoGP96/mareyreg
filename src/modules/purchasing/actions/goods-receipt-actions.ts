"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";
import { nextFolio, DOC_TYPES } from "@/lib/folio";
import { applyInventoryEntry } from "@/lib/valuation";

export interface ReceiptLineInput {
  poLineId: number;
  quantity: number;
  unitCost?: number;   // si se omite, usa el unitCost de la linea de OC
  lotCode?: string;    // para productos con tracksLots
  expirationDate?: string;
  manufactureDate?: string;
}

export interface ReceiptInput {
  poId: number;
  notes?: string;
  lines: ReceiptLineInput[];
}

export async function createGoodsReceipt(
  data: ReceiptInput
): Promise<ActionResult<{ receiptId: number; folio: string }>> {
  try {
    if (!data.lines.length) {
      return { success: false, error: "Debe recibir al menos una linea" };
    }
    for (const l of data.lines) {
      if (l.quantity <= 0) return { success: false, error: "Las cantidades deben ser mayores a 0" };
    }

    const po = await db.purchaseOrder.findUnique({
      where: { poId: data.poId },
      include: { lines: { include: { product: true } }, supplier: true },
    });
    if (!po) return { success: false, error: "OC no encontrada" };
    if (po.status === "cancelled" || po.status === "received") {
      return { success: false, error: `La OC esta en estado ${po.status}` };
    }

    // Validar que cada linea no exceda lo pendiente
    for (const rl of data.lines) {
      const poLine = po.lines.find((pl) => pl.lineId === rl.poLineId);
      if (!poLine) return { success: false, error: `Linea de OC ${rl.poLineId} no existe` };
      const pending = Number(poLine.quantity) - Number(poLine.receivedQty);
      if (rl.quantity > pending) {
        return {
          success: false,
          error: `La linea ${poLine.product.name} excede lo pendiente (${pending})`,
        };
      }
    }

    const userId = await getCurrentUserId();

    const receipt = await db.$transaction(async (tx) => {
      const folio = await nextFolio(tx, DOC_TYPES.GOODS_RECEIPT);

      const created = await tx.goodsReceipt.create({
        data: {
          folio,
          poId: data.poId,
          notes: data.notes || null,
          createdBy: userId,
        },
      });

      for (const rl of data.lines) {
        const poLine = po.lines.find((pl) => pl.lineId === rl.poLineId)!;
        const unitCost = rl.unitCost ?? Number(poLine.unitCost);

        // Lote si aplica
        let lotId: number | null = null;
        if (poLine.product.tracksLots && rl.lotCode) {
          const existing = await tx.lot.findUnique({
            where: { productId_code: { productId: poLine.productId, code: rl.lotCode } },
          });
          const lot = existing
            ? existing
            : await tx.lot.create({
                data: {
                  productId: poLine.productId,
                  code: rl.lotCode,
                  manufactureDate: rl.manufactureDate ? new Date(rl.manufactureDate) : null,
                  expirationDate: rl.expirationDate ? new Date(rl.expirationDate) : null,
                  supplierId: po.supplierId,
                },
              });
          lotId = lot.lotId;

          await tx.lotStock.upsert({
            where: { lotId_warehouseId: { lotId, warehouseId: po.warehouseId } },
            create: { lotId, warehouseId: po.warehouseId, quantity: rl.quantity },
            update: { quantity: { increment: rl.quantity } },
          });
        } else if (poLine.product.tracksLots && !rl.lotCode) {
          throw new Error(
            `El producto ${poLine.product.name} requiere lote. Indica un codigo de lote.`
          );
        }

        // Crear linea de recepcion
        await tx.goodsReceiptLine.create({
          data: {
            receiptId: created.receiptId,
            poLineId: rl.poLineId,
            quantity: rl.quantity,
            unitCost,
            lotId,
          },
        });

        // Incrementar recibido en la linea de OC
        await tx.purchaseOrderLine.update({
          where: { lineId: rl.poLineId },
          data: { receivedQty: { increment: rl.quantity } },
        });

        // Valuacion: entrada
        await applyInventoryEntry(tx, {
          productId: poLine.productId,
          warehouseId: po.warehouseId,
          qty: rl.quantity,
          unitCost,
          lotId,
          sourceType: "purchase",
          sourceId: created.receiptId,
        });

        // StockMovement
        await tx.stockMovement.create({
          data: {
            productId: poLine.productId,
            warehouseId: po.warehouseId,
            quantity: rl.quantity,
            movementType: "entry",
            unitCost,
            referenceDoc: folio,
            notes: `Recepcion OC ${po.folio}`,
            createdBy: userId,
          },
        });

        // StockLevel
        await tx.stockLevel.upsert({
          where: {
            productId_warehouseId: {
              productId: poLine.productId,
              warehouseId: po.warehouseId,
            },
          },
          create: {
            productId: poLine.productId,
            warehouseId: po.warehouseId,
            currentQuantity: rl.quantity,
          },
          update: {
            currentQuantity: { increment: rl.quantity },
            lastUpdated: new Date(),
          },
        });
      }

      // Recalcular estado de la OC
      const updatedLines = await tx.purchaseOrderLine.findMany({ where: { poId: data.poId } });
      const allComplete = updatedLines.every(
        (l) => Number(l.receivedQty) >= Number(l.quantity)
      );
      const anyReceived = updatedLines.some((l) => Number(l.receivedQty) > 0);
      const newStatus = allComplete ? "received" : anyReceived ? "partial" : po.status;

      await tx.purchaseOrder.update({
        where: { poId: data.poId },
        data: { status: newStatus },
      });

      await createAuditLog(tx, {
        action: "create",
        entityType: "GoodsReceipt",
        entityId: created.receiptId,
        module: "purchasing",
        userId,
        newValues: { folio, poId: data.poId, lines: data.lines },
      });

      return created;
    });

    revalidatePath("/purchase-orders");
    revalidatePath("/receipts");
    revalidatePath("/stock");
    return { success: true, data: { receiptId: receipt.receiptId, folio: receipt.folio } };
  } catch (error) {
    console.error("Error creating receipt:", error);
    const msg = error instanceof Error ? error.message : "Error al crear la recepcion";
    return { success: false, error: msg };
  }
}
