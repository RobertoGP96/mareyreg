import { applyInventoryEntry, applyInventoryExit } from "@/lib/valuation";
import { getEffectivePrice } from "@/modules/inventory/lib/effective-price";
import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;

export interface PriceOverride {
  productId: number;
  catalogPrice: number;
  chargedPrice: number;
}

export interface DispatchLineInput {
  productId: number;
  quantity: number;
  /** Precio manual (POS/B2B). Si se omite, se fuerza el precio efectivo de catálogo (webstore). */
  unitPrice?: number;
  discount?: number;
  lotId?: number;
}

export interface DispatchLineResult {
  productId: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  unitCost: number;
  subtotal: number;
  lotId: number | null;
}

export interface DispatchLinesOptions {
  invoiceId: number;
  folio: string;
  warehouseId: number;
  /** Requerido si `allowManualPrice` es true, para resolver el precio efectivo de catálogo. */
  customerId?: number;
  lines: DispatchLineInput[];
  userId?: number;
  /**
   * true (sales/POS/B2B): acepta unitPrice manual del caller y registra un
   * priceOverride en audit cuando difiere del precio de catálogo.
   * false (webstore, default): ignora unitPrice del input y fuerza el precio
   * efectivo de catálogo server-side.
   */
  allowManualPrice?: boolean;
  /** Prefijo de las notas del StockMovement, p.ej. "Venta" o "Venta tienda en línea". */
  movementNotesPrefix?: string;
}

export interface DispatchLinesResult {
  lineResults: DispatchLineResult[];
  priceOverrides: PriceOverride[];
}

/**
 * Descuenta stock, aplica valuación (salida) y registra StockMovement +
 * InvoiceLine para un conjunto de líneas de venta. Usado tanto por
 * facturación POS/B2B (sales) como por procesamiento de órdenes de la
 * tienda en línea (webstore) — ambos flujos comparten el mismo
 * comportamiento de inventario/valuación, solo difieren en el origen del
 * precio unitario.
 */
export async function dispatchLines(
  tx: PrismaTx,
  options: DispatchLinesOptions
): Promise<DispatchLinesResult> {
  const {
    invoiceId,
    folio,
    warehouseId,
    customerId,
    lines,
    userId,
    allowManualPrice = false,
    movementNotesPrefix = "Venta",
  } = options;

  const lineResults: DispatchLineResult[] = [];
  const priceOverrides: PriceOverride[] = [];

  // Batch: una sola query para todos los productos de las lineas, en vez de
  // un findUnique por linea. Evita ademas el findUnique duplicado dentro de
  // resolveMethod (valuation.ts) pasando el metodo ya resuelto.
  const uniqueProductIds = [...new Set(lines.map((l) => l.productId))];
  const products = await tx.product.findMany({
    where: { productId: { in: uniqueProductIds } },
  });
  const productById = new Map(products.map((p) => [p.productId, p]));

  for (const line of lines) {
    const product = productById.get(line.productId);
    if (!product) throw new Error(`Producto ${line.productId} no existe`);

    let unitPrice = line.unitPrice ?? 0;

    if (allowManualPrice) {
      // Precio de catálogo server-side (fuente de verdad). El POS permite
      // edición manual legítima del precio, así que se acepta el precio que
      // envía el cliente, pero se registra en el audit log cuando difiere
      // del precio de catálogo, para trazabilidad.
      const effective = await getEffectivePrice(tx, {
        productId: line.productId,
        quantity: line.quantity,
        customerId,
      });
      if (Math.abs(unitPrice - effective.finalPrice) > 0.0001) {
        priceOverrides.push({
          productId: line.productId,
          catalogPrice: effective.finalPrice,
          chargedPrice: unitPrice,
        });
      }
    } else {
      // Webstore: precio efectivo de catálogo forzado server-side, nunca el
      // que envía el cliente/integración externa.
      const effective = await getEffectivePrice(tx, {
        productId: line.productId,
        quantity: line.quantity,
        customerId,
      });
      unitPrice = effective.finalPrice;
    }

    let unitCost = 0;

    if (!product.isService) {
      // Descontar StockLevel de forma atómica: si el producto no permite
      // stock negativo, updateMany solo aplica si currentQuantity >= qty;
      // si count === 0, no había stock suficiente. Si allowNegative es
      // true, se descuenta sin condición (puede quedar en negativo).
      if (!product.allowNegative) {
        const updated = await tx.stockLevel.updateMany({
          where: {
            productId: line.productId,
            warehouseId,
            currentQuantity: { gte: line.quantity },
          },
          data: {
            currentQuantity: { decrement: line.quantity },
            lastUpdated: new Date(),
          },
        });
        if (updated.count === 0) {
          const lvl = await tx.stockLevel.findUnique({
            where: {
              productId_warehouseId: { productId: line.productId, warehouseId },
            },
          });
          const current = lvl ? Number(lvl.currentQuantity) : 0;
          throw new Error(
            `Stock insuficiente para ${product.name}. Disponible: ${current}, solicitado: ${line.quantity}`
          );
        }
      } else {
        await tx.stockLevel.upsert({
          where: {
            productId_warehouseId: { productId: line.productId, warehouseId },
          },
          create: {
            productId: line.productId,
            warehouseId,
            currentQuantity: -line.quantity,
          },
          update: {
            currentQuantity: { decrement: line.quantity },
            lastUpdated: new Date(),
          },
        });
      }

      // Valuación: salida (metodo pre-resuelto desde el batch de arriba, evita
      // el findUnique duplicado dentro de applyInventoryExit/resolveMethod)
      const exit = await applyInventoryExit(
        tx,
        {
          productId: line.productId,
          warehouseId,
          qty: line.quantity,
        },
        product.valuationMethod
      );
      unitCost = exit.avgCostUsed;

      // StockMovement exit
      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          warehouseId,
          quantity: line.quantity,
          movementType: "exit",
          unitCost,
          referenceDoc: folio,
          notes: `${movementNotesPrefix} ${folio}`,
          createdBy: userId ?? null,
        },
      });

      // LotStock si se especificó lote (solo aplica al flujo sales/POS)
      if (line.lotId) {
        await tx.lotStock.update({
          where: { lotId_warehouseId: { lotId: line.lotId, warehouseId } },
          data: { quantity: { decrement: line.quantity } },
        });
      }
    }

    const discount = line.discount ?? 0;
    const subtotal = line.quantity * unitPrice - discount;

    lineResults.push({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice,
      discount,
      unitCost,
      subtotal,
      lotId: line.lotId ?? null,
    });
  }

  await tx.invoiceLine.createMany({
    data: lineResults.map((r) => ({ invoiceId, ...r })),
  });

  return { lineResults, priceOverrides };
}

export interface ReverseInvoiceLineInput {
  productId: number;
  quantity: number;
  unitCost: number;
  lotId?: number | null;
}

export interface ReverseInvoiceStockOptions {
  folio: string;
  /** warehouseId por línea (resuelto por el caller: SalesOrder.warehouseId o StockMovement original). */
  warehouseByProductId: Map<number, number>;
  lines: ReverseInvoiceLineInput[];
  userId?: number;
  /** Prefijo de las notas del StockMovement de reverso, p.ej. "Cancelación factura". */
  movementNotesPrefix?: string;
}

export interface ReverseInvoiceLineResult {
  productId: number;
  warehouseId: number;
  quantity: number;
  unitCost: number;
}

/**
 * Reversa el stock y la valuación de las líneas de una factura cancelada:
 * por cada línea con producto físico (no servicio), crea un StockMovement de
 * entrada tipo "adjustment", incrementa StockLevel y reingresa la valuación
 * vía applyInventoryEntry usando el unitCost que se registró originalmente
 * en la línea (el costo que salió, no el costo actual de mercado).
 *
 * Reutilizable por una futura cancelación de órdenes web (webstore).
 */
export async function reverseInvoiceStock(
  tx: PrismaTx,
  options: ReverseInvoiceStockOptions
): Promise<ReverseInvoiceLineResult[]> {
  const { folio, warehouseByProductId, lines, userId, movementNotesPrefix = "Cancelación factura" } = options;
  const results: ReverseInvoiceLineResult[] = [];

  for (const line of lines) {
    // unitCost 0 identifica líneas de servicio (dispatchLines nunca mueve
    // stock/valuación para servicios), así que se omiten del reverso.
    if (line.unitCost <= 0) continue;

    const warehouseId = warehouseByProductId.get(line.productId);
    if (warehouseId === undefined) {
      throw new Error(`No se pudo determinar el almacén de origen para el producto ${line.productId}`);
    }

    await tx.stockLevel.upsert({
      where: { productId_warehouseId: { productId: line.productId, warehouseId } },
      create: { productId: line.productId, warehouseId, currentQuantity: line.quantity },
      update: { currentQuantity: { increment: line.quantity }, lastUpdated: new Date() },
    });

    await applyInventoryEntry(tx, {
      productId: line.productId,
      warehouseId,
      qty: line.quantity,
      unitCost: line.unitCost,
      lotId: line.lotId ?? null,
      sourceType: "invoice_cancel",
    });

    await tx.stockMovement.create({
      data: {
        productId: line.productId,
        warehouseId,
        quantity: line.quantity,
        movementType: "adjustment",
        unitCost: line.unitCost,
        referenceDoc: folio,
        notes: `${movementNotesPrefix} ${folio}`,
        createdBy: userId ?? null,
      },
    });

    if (line.lotId) {
      await tx.lotStock.update({
        where: { lotId_warehouseId: { lotId: line.lotId, warehouseId } },
        data: { quantity: { increment: line.quantity } },
      });
    }

    results.push({ productId: line.productId, warehouseId, quantity: line.quantity, unitCost: line.unitCost });
  }

  return results;
}
