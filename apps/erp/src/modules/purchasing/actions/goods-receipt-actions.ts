"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { nextFolio, DOC_TYPES } from "@/lib/folio";
import { applyInventoryEntry } from "@/lib/valuation";
import {
  toBaseQuantity,
  formatEquivalence,
  piecesFor,
  catchWeightBaseQuantity,
  formatCatchWeight,
} from "@/modules/inventory/lib/units";
import { getBaseCurrency, getRateToBase, GlobalRateNotConfiguredError } from "@/lib/currency";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

const BUSINESS_ERRORS = new Set([
  "OC no encontrada",
  "La cantidad excede lo pendiente por recibir",
]);

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof GlobalRateNotConfiguredError) return error.message;
  if (error instanceof Error) {
    if (BUSINESS_ERRORS.has(error.message)) return error.message;
    if (error.message.includes("requiere lote")) return error.message;
    if (error.message.startsWith("Linea de OC")) return error.message;
    if (error.message.startsWith("La OC esta en estado")) return error.message;
    if (error.message.startsWith("La presentación")) return error.message;
    if (error.message.startsWith("El producto")) return error.message;
    if (error.message.startsWith("Captura el peso")) return error.message;
    if (error.message.startsWith("Se esperaban")) return error.message;
    if (error.message === "No se puede recibir la misma linea de OC dos veces en una recepcion") {
      return error.message;
    }
  }
  return fallback;
}

export interface ReceiptLineInput {
  poLineId: number;
  quantity: number;
  unitCost?: number;       // si se omite, usa el unitCost de la linea de OC. En la unidad de `presentationId` (o de la linea de OC si se omite).
  presentationId?: number; // si se omite, hereda la presentacion de la linea de OC
  lotCode?: string;        // para productos con tracksLots
  expirationDate?: string;
  manufactureDate?: string;
  // Peso real (kg) de cada pieza recibida, en orden — solo para productos
  // catch-weight con presentación de piezas. length debe ser exactamente
  // piecesFor(quantity, piecesPerUnit); cada valor > 0.
  pieceWeights?: number[];
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
    const seenLineIds = new Set<number>();
    for (const l of data.lines) {
      if (seenLineIds.has(l.poLineId)) {
        return {
          success: false,
          error: "No se puede recibir la misma linea de OC dos veces en una recepcion",
        };
      }
      seenLineIds.add(l.poLineId);
    }

    const userId = await requireCurrentUserId();

    const receipt = await db.$transaction(async (tx) => {
      // Todo el estado de la OC se lee y valida dentro de la tx para evitar
      // sobre-recepcion por lecturas obsoletas (dos recepciones concurrentes
      // sobre la misma OC).
      const po = await tx.purchaseOrder.findUnique({
        where: { poId: data.poId },
        include: { lines: { include: { product: true, presentation: true } }, supplier: true },
      });
      if (!po) throw new Error("OC no encontrada");
      if (po.status === "cancelled" || po.status === "received") {
        throw new Error(`La OC esta en estado ${po.status}`);
      }

      for (const rl of data.lines) {
        if (!po.lines.some((pl) => pl.lineId === rl.poLineId)) {
          throw new Error(`Linea de OC ${rl.poLineId} no existe`);
        }
      }

      const folio = await nextFolio(tx, DOC_TYPES.GOODS_RECEIPT);

      // Moneda de la recepcion = moneda de la OC (heredada, no editable por
      // linea). Snapshot de tasa AL RECIBIR: la tasa pudo cambiar desde que se
      // creo la OC, y es la que valua esta recepcion (no la de la OC).
      const isBaseCurrency = po.currencyId == null;
      let receiptExchangeRate: number | null = null;
      if (!isBaseCurrency) {
        const snapshot = await getRateToBase(tx, po.currencyId!);
        receiptExchangeRate = snapshot.rate;
      }

      const created = await tx.goodsReceipt.create({
        data: {
          folio,
          poId: data.poId,
          notes: data.notes || null,
          createdBy: userId,
          currencyId: po.currencyId,
          exchangeRate: receiptExchangeRate,
        },
      });

      for (const rl of data.lines) {
        const poLine = po.lines.find((pl) => pl.lineId === rl.poLineId)!;
        const unitCost = rl.unitCost ?? Number(poLine.unitCost);

        // Presentacion de la linea de recepcion: por default hereda la de la
        // linea de OC (mismo factor, ya validado al crear la OC). Si la
        // recepcion indica una presentacion distinta, se valida server-side
        // igual que en resolvePresentation (stock-actions.ts): pertenencia al
        // producto y que este activa. El factor SIEMPRE se lee de la BD.
        let presentationId: number | null = poLine.presentationId;
        let unitFactor = Number(poLine.unitFactor);
        if (rl.presentationId != null && rl.presentationId !== poLine.presentationId) {
          const presentation = await tx.productPresentation.findUnique({
            where: { presentationId: rl.presentationId },
          });
          if (!presentation || presentation.productId !== poLine.productId) {
            throw new Error(
              `La presentación seleccionada no corresponde al producto ${poLine.productId}`
            );
          }
          if (!presentation.isActive) {
            throw new Error(`La presentación "${presentation.name}" está inactiva`);
          }
          presentationId = presentation.presentationId;
          unitFactor = Number(presentation.factor);
        }

        // Catch-weight: el peso real se pesa pieza por pieza al recibir, la
        // baseQuantity NUNCA viene del factor nominal (solo estima). Requiere
        // una presentación con piezas (piecesPerUnit) — nunca la unidad base.
        const isCatchWeight = poLine.product.isCatchWeight;
        let piecesPerUnit: number | null = null;
        if (isCatchWeight) {
          if (presentationId == null) {
            throw new Error(
              `El producto ${poLine.product.name} es de peso variable: la recepción requiere una presentación con piezas`
            );
          }
          // presentationId pudo venir de poLine (herencia) o del override de
          // arriba; en ambos casos necesitamos su piecesPerUnit fresco de BD.
          const presentation =
            rl.presentationId != null && rl.presentationId !== poLine.presentationId
              ? await tx.productPresentation.findUnique({ where: { presentationId } })
              : poLine.presentation;
          piecesPerUnit = presentation?.piecesPerUnit ?? null;
          if (piecesPerUnit == null) {
            throw new Error(
              `El producto ${poLine.product.name} es de peso variable: la presentación seleccionada no tiene piezas configuradas`
            );
          }
        } else if (rl.pieceWeights != null) {
          throw new Error(
            `El producto ${poLine.product.name} no es de peso variable: no debe capturar pesos por pieza`
          );
        }

        let pieces: number | null = null;
        let pieceWeights: number[] | null = null;
        let baseQuantity: number;

        if (isCatchWeight) {
          pieces = piecesFor(rl.quantity, piecesPerUnit!);
          if (!rl.pieceWeights) {
            throw new Error(`Captura el peso de cada pieza para ${poLine.product.name}`);
          }
          if (rl.pieceWeights.length !== pieces) {
            throw new Error(
              `Se esperaban ${pieces} pesos para ${poLine.product.name}, se recibieron ${rl.pieceWeights.length}`
            );
          }
          if (rl.pieceWeights.some((w) => !Number.isFinite(w) || w <= 0)) {
            throw new Error(`Captura el peso de cada pieza para ${poLine.product.name}: cada peso debe ser mayor a 0`);
          }
          pieceWeights = rl.pieceWeights;
          const totalWeightKg = pieceWeights.reduce((s, w) => s + w, 0);
          baseQuantity = catchWeightBaseQuantity(totalWeightKg);
        } else {
          // baseQuantity: SIEMPRE lo que entra a stock/valuacion/kardex.
          baseQuantity = toBaseQuantity(rl.quantity, unitFactor);
        }

        // Costo por unidad base: si el costo capturado es por presentacion
        // (ej. $240 la caja de 24), se divide por el factor ($10 la unidad base).
        // En catch-weight, unitCost YA viene capturado en $/kg (unidad base) —
        // no se divide entre el factor nominal, que solo estima el peso, no el
        // costo real de la línea.
        const unitCostPerBase = isCatchWeight ? unitCost : unitCost / unitFactor;
        const unitCostBasePerBaseUnit = isBaseCurrency
          ? unitCostPerBase
          : unitCostPerBase * receiptExchangeRate!;
        const equivalenceNote = isCatchWeight
          ? ` — ${formatCatchWeight(rl.quantity, poLine.presentation?.name ?? "presentación", pieces!, baseQuantity)}`
          : unitFactor !== 1
          ? ` — ${formatEquivalence(rl.quantity, unitFactor, poLine.presentation?.name ?? "presentación", poLine.product.unit)}`
          : "";

        // Incremento atomico de receivedQty condicionado a no exceder quantity.
        // Prisma updateMany no permite comparar dos columnas entre si, asi que
        // acotamos el `lte` al valor maximo permitido (quantity - rl.quantity)
        // usando el snapshot de `quantity` (inmutable tras crear la OC) leido
        // arriba dentro de esta misma tx. Si otra recepcion concurrente ya
        // incremento receivedQty por encima de ese limite, count === 0 y abortamos.
        // receivedQty se lleva en la MISMA unidad que quantity del PO line
        // (unidad comprada/presentacion), nunca en base.
        const maxReceivedBefore = Number(poLine.quantity) - rl.quantity;
        const updatedLine = await tx.purchaseOrderLine.updateMany({
          where: { lineId: rl.poLineId, receivedQty: { lte: maxReceivedBefore } },
          data: { receivedQty: { increment: rl.quantity } },
        });
        if (updatedLine.count !== 1) {
          throw new Error("La cantidad excede lo pendiente por recibir");
        }

        // Lote si aplica. LotStock se lleva en unidad base, igual que StockLevel.
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
            create: { lotId, warehouseId: po.warehouseId, quantity: baseQuantity },
            update: { quantity: { increment: baseQuantity } },
          });
        } else if (poLine.product.tracksLots && !rl.lotCode) {
          throw new Error(
            `El producto ${poLine.product.name} requiere lote. Indica un codigo de lote.`
          );
        }

        // Crear linea de recepcion. quantity/unitCost quedan en la unidad
        // recibida (presentacion), en la moneda del documento;
        // presentationId/unitFactor/baseQuantity son el snapshot de conversion
        // a unidad base. unitCostBase es el equivalente en CUP por unidad recibida.
        await tx.goodsReceiptLine.create({
          data: {
            receiptId: created.receiptId,
            poLineId: rl.poLineId,
            quantity: rl.quantity,
            unitCost,
            unitCostBase: isBaseCurrency ? null : unitCost * receiptExchangeRate!,
            lotId,
            presentationId,
            unitFactor,
            baseQuantity,
            pieces,
            pieceWeights: pieceWeights ?? undefined,
          },
        });

        // Valuacion: entrada. SIEMPRE en unidad base con costo por unidad base
        // en CUP; si el documento esta en otra moneda, se persiste el trio
        // original (moneda, costo original, tasa) junto al costo en CUP.
        await applyInventoryEntry(tx, {
          productId: poLine.productId,
          warehouseId: po.warehouseId,
          qty: baseQuantity,
          unitCost: unitCostBasePerBaseUnit,
          lotId,
          sourceType: "purchase",
          sourceId: created.receiptId,
          origCurrencyId: isBaseCurrency ? undefined : po.currencyId!,
          origUnitCost: isBaseCurrency ? undefined : unitCostPerBase,
          exchangeRate: isBaseCurrency ? undefined : receiptExchangeRate!,
        });

        // StockMovement: cantidad en unidad base, con nota de equivalencia
        // cuando la presentacion no es la base (factor !== 1). unitCost SIEMPRE
        // en CUP; el trio original se persiste solo si el documento no es la base.
        // pieces solo se llena en catch-weight, para el kardex de piezas.
        await tx.stockMovement.create({
          data: {
            productId: poLine.productId,
            warehouseId: po.warehouseId,
            quantity: baseQuantity,
            pieces,
            movementType: "entry",
            unitCost: unitCostBasePerBaseUnit,
            origCurrencyId: isBaseCurrency ? null : po.currencyId,
            origUnitCost: isBaseCurrency ? null : unitCostPerBase,
            exchangeRate: isBaseCurrency ? null : receiptExchangeRate,
            referenceDoc: folio,
            notes: `Recepcion OC ${po.folio}${equivalenceNote}`,
            createdBy: userId,
          },
        });

        // StockLevel: SIEMPRE en unidad base (kg en catch-weight). currentPieces
        // es un contador auxiliar (no participa en valuación) que solo se
        // incrementa para productos catch-weight.
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
            currentQuantity: baseQuantity,
            currentPieces: pieces ?? 0,
          },
          update: {
            currentQuantity: { increment: baseQuantity },
            ...(pieces != null ? { currentPieces: { increment: pieces } } : {}),
            lastUpdated: new Date(),
          },
        });

        // Costo de reposicion: ultimo costo de compra por producto, siempre
        // en moneda del documento + equivalente CUP. Espejo de solo lectura
        // en Product.costPrice, alimentado unicamente por compras.
        const productCurrencyId = po.currencyId ?? (await getBaseCurrency(tx)).currencyId;
        await tx.productCost.upsert({
          where: { productId: poLine.productId },
          create: {
            productId: poLine.productId,
            currencyId: productCurrencyId,
            lastUnitCost: unitCostPerBase,
            lastUnitCostBase: unitCostBasePerBaseUnit,
            lastExchangeRate: isBaseCurrency ? null : receiptExchangeRate,
            lastReceiptId: created.receiptId,
            lastReceivedAt: created.receivedAt,
          },
          update: {
            currencyId: productCurrencyId,
            lastUnitCost: unitCostPerBase,
            lastUnitCostBase: unitCostBasePerBaseUnit,
            lastExchangeRate: isBaseCurrency ? null : receiptExchangeRate,
            lastReceiptId: created.receiptId,
            lastReceivedAt: created.receivedAt,
          },
        });
        await tx.product.update({
          where: { productId: poLine.productId },
          data: { costPrice: unitCostBasePerBaseUnit },
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
    if (isAuthError(error)) {
      return { success: false, error: "Debes iniciar sesion para crear una recepcion" };
    }
    console.error("Error creating receipt:", error);
    return { success: false, error: toUserMessage(error, "Error al crear la recepcion") };
  }
}
