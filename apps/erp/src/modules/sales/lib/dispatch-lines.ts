import { applyInventoryEntry, applyInventoryExit } from "@/lib/valuation";
import { getEffectiveLinePrices, lineKey } from "@/modules/inventory/lib/effective-price";
import { toBaseQuantity, formatEquivalence } from "@/modules/inventory/lib/units";
import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;

export interface PriceOverride {
  productId: number;
  catalogPrice: number;
  chargedPrice: number;
}

export interface DispatchLineInput {
  productId: number;
  presentationId?: number;
  quantity: number;
  /** Precio manual (POS/B2B). Si se omite, se fuerza el precio efectivo de catálogo (webstore). */
  unitPrice?: number;
  discount?: number;
  lotId?: number;
}

export interface DispatchLineResult {
  productId: number;
  presentationId: number | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  unitCost: number;
  subtotal: number;
  lotId: number | null;
  unitFactor: number;
  baseQuantity: number;
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

  // Batch: una sola query para todas las presentaciones referenciadas por las
  // lineas. El factor SIEMPRE se toma de esta query, nunca del input del
  // caller, para que no se pueda falsificar la conversión a unidad base.
  const uniquePresentationIds = [
    ...new Set(lines.map((l) => l.presentationId).filter((id): id is number => id != null)),
  ];
  const presentations = uniquePresentationIds.length
    ? await tx.productPresentation.findMany({
        where: { presentationId: { in: uniquePresentationIds } },
      })
    : [];
  const presentationById = new Map(presentations.map((p) => [p.presentationId, p]));

  // Precio efectivo de TODAS las líneas en un solo batch (cubre con y sin
  // presentación: sin presentationId se comporta igual que antes).
  const effectivePrices = await getEffectiveLinePrices(
    tx,
    lines.map((l) => ({ productId: l.productId, presentationId: l.presentationId, quantity: l.quantity })),
    { customerId }
  );

  for (const line of lines) {
    const product = productById.get(line.productId);
    if (!product) throw new Error(`Producto ${line.productId} no existe`);

    let presentationId: number | null = null;
    let factor = 1;
    let presentationName: string | null = null;

    if (line.presentationId != null) {
      const presentation = presentationById.get(line.presentationId);
      if (!presentation || presentation.productId !== line.productId) {
        throw new Error(
          `La presentación seleccionada no corresponde al producto ${line.productId}`
        );
      }
      if (!presentation.isActive) {
        throw new Error(`La presentación "${presentation.name}" está inactiva`);
      }
      presentationId = presentation.presentationId;
      factor = Number(presentation.factor);
      presentationName = presentation.name;
    }

    const baseQty = toBaseQuantity(line.quantity, factor);

    const effective = effectivePrices.get(lineKey(line.productId, line.presentationId));
    if (!effective) throw new Error(`Producto ${line.productId} no encontrado`);

    let unitPrice = line.unitPrice ?? 0;

    if (allowManualPrice) {
      // Precio de catálogo server-side (fuente de verdad, por unidad de
      // PRESENTACIÓN). El POS permite edición manual legítima del precio, así
      // que se acepta el precio que envía el cliente, pero se registra en el
      // audit log cuando difiere del precio de catálogo, para trazabilidad.
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
      unitPrice = effective.finalPrice;
    }

    let unitCost = 0;

    if (!product.isService) {
      const equivalenceNote =
        factor !== 1 && presentationName
          ? ` — ${formatEquivalence(line.quantity, factor, presentationName, product.unit)}`
          : "";

      // Descontar StockLevel de forma atómica: si el producto no permite
      // stock negativo, updateMany solo aplica si currentQuantity >= qty;
      // si count === 0, no había stock suficiente. Si allowNegative es
      // true, se descuenta sin condición (puede quedar en negativo). El
      // descuento SIEMPRE ocurre en unidad base.
      if (!product.allowNegative) {
        const updated = await tx.stockLevel.updateMany({
          where: {
            productId: line.productId,
            warehouseId,
            currentQuantity: { gte: baseQty },
          },
          data: {
            currentQuantity: { decrement: baseQty },
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
          const requestedText =
            factor !== 1 && presentationName
              ? `${formatEquivalence(line.quantity, factor, presentationName, product.unit)}`
              : `${baseQty} ${product.unit}`;
          throw new Error(
            `Stock insuficiente para ${product.name}. Disponible: ${current} ${product.unit}, solicitado: ${requestedText}`
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
            currentQuantity: -baseQty,
          },
          update: {
            currentQuantity: { decrement: baseQty },
            lastUpdated: new Date(),
          },
        });
      }

      // Valuación: salida (metodo pre-resuelto desde el batch de arriba, evita
      // el findUnique duplicado dentro de applyInventoryExit/resolveMethod).
      // Siempre en unidad base.
      const exit = await applyInventoryExit(
        tx,
        {
          productId: line.productId,
          warehouseId,
          qty: baseQty,
        },
        product.valuationMethod
      );
      unitCost = exit.avgCostUsed;

      // StockMovement exit (kardex SIEMPRE en unidad base)
      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          warehouseId,
          quantity: baseQty,
          movementType: "exit",
          unitCost,
          referenceDoc: folio,
          notes: `${movementNotesPrefix} ${folio}${equivalenceNote}`,
          createdBy: userId ?? null,
        },
      });

      // LotStock si se especificó lote (solo aplica al flujo sales/POS)
      if (line.lotId) {
        await tx.lotStock.update({
          where: { lotId_warehouseId: { lotId: line.lotId, warehouseId } },
          data: { quantity: { decrement: baseQty } },
        });
      }
    }

    const discount = line.discount ?? 0;
    const subtotal = line.quantity * unitPrice - discount;

    lineResults.push({
      productId: line.productId,
      presentationId,
      quantity: line.quantity,
      unitPrice,
      discount,
      unitCost,
      subtotal,
      lotId: line.lotId ?? null,
      unitFactor: factor,
      baseQuantity: baseQty,
    });
  }

  await tx.invoiceLine.createMany({
    data: lineResults.map((r) => ({
      invoiceId,
      productId: r.productId,
      presentationId: r.presentationId,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      discount: r.discount,
      unitCost: r.unitCost,
      subtotal: r.subtotal,
      lotId: r.lotId,
      unitFactor: r.unitFactor,
      baseQuantity: r.baseQuantity,
    })),
  });

  return { lineResults, priceOverrides };
}

export interface ReverseInvoiceLineInput {
  productId: number;
  quantity: number;
  /** Cantidad en unidad base (quantity × unitFactor). Usada para reingresar stock/valuación/kardex. */
  baseQuantity: number;
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

    const baseQty = line.baseQuantity;

    await tx.stockLevel.upsert({
      where: { productId_warehouseId: { productId: line.productId, warehouseId } },
      create: { productId: line.productId, warehouseId, currentQuantity: baseQty },
      update: { currentQuantity: { increment: baseQty }, lastUpdated: new Date() },
    });

    await applyInventoryEntry(tx, {
      productId: line.productId,
      warehouseId,
      qty: baseQty,
      unitCost: line.unitCost,
      lotId: line.lotId ?? null,
      sourceType: "invoice_cancel",
    });

    await tx.stockMovement.create({
      data: {
        productId: line.productId,
        warehouseId,
        quantity: baseQty,
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
        data: { quantity: { increment: baseQty } },
      });
    }

    results.push({ productId: line.productId, warehouseId, quantity: line.quantity, unitCost: line.unitCost });
  }

  return results;
}
