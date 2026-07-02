import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;

const SHADOW_WAREHOUSE_NAME = "Pacas";
const SHADOW_PRODUCT_CATEGORY = "Pacas";
const SHADOW_MOVEMENT_UNIT = "paca";

export interface ShadowProductRef {
  productId: number;
  warehouseId: number;
}

/**
 * Devuelve (o crea) el almacen dedicado del espejo contable de pacas.
 * Get-or-create por nombre: Warehouse no tiene columna `code`.
 */
async function ensureShadowWarehouse(tx: PrismaTx): Promise<number> {
  const existing = await tx.warehouse.findFirst({
    where: { name: SHADOW_WAREHOUSE_NAME },
    select: { warehouseId: true },
  });
  if (existing) return existing.warehouseId;

  const created = await tx.warehouse.create({
    data: {
      name: SHADOW_WAREHOUSE_NAME,
      warehouseType: "pacas",
      isActive: true,
    },
    select: { warehouseId: true },
  });
  return created.warehouseId;
}

/**
 * Asegura que una PacaCategory tenga un Product sombra vinculado, para que
 * sus movimientos aparezcan en el kardex general (stockMovement.findMany).
 * El inventario canonico sigue siendo PacaInventory; el producto sombra es
 * un espejo contable de solo lectura para reporting (kardex, ABC).
 *
 * Si la categoria ya tiene inventario (available+reserved > 0) al momento de
 * crear el espejo, emite un movimiento de ajuste inicial (`entry`) para que
 * el kardex arranque con saldo coherente en lugar de partir en 0.
 *
 * Debe llamarse dentro de la misma transaccion del caller: un fallo aqui
 * revierte toda la operacion (consistencia por sobre disponibilidad).
 */
export async function ensureShadowProduct(
  tx: PrismaTx,
  categoryId: number
): Promise<ShadowProductRef> {
  const category = await tx.pacaCategory.findUnique({
    where: { categoryId },
    select: { productId: true, name: true },
  });
  if (!category) {
    throw new Error("Categoria de pacas no encontrada");
  }

  if (category.productId) {
    const warehouse = await tx.warehouse.findFirst({
      where: { name: SHADOW_WAREHOUSE_NAME },
      select: { warehouseId: true },
    });
    // El warehouse deberia existir siempre que productId ya este seteado,
    // pero se recrea defensivamente si faltara (no deberia ocurrir en uso normal).
    const warehouseId = warehouse?.warehouseId ?? (await ensureShadowWarehouse(tx));
    return { productId: category.productId, warehouseId };
  }

  const warehouseId = await ensureShadowWarehouse(tx);

  const product = await tx.product.create({
    data: {
      name: category.name,
      sku: `PACA-${categoryId}`,
      category: SHADOW_PRODUCT_CATEGORY,
      unit: SHADOW_MOVEMENT_UNIT,
      valuationMethod: "average",
      allowNegative: true,
      isActive: true,
      webstoreEnabled: false,
      notes: "Producto sombra generado automaticamente para el kardex del modulo de pacas. No editar manualmente.",
    },
    select: { productId: true },
  });

  await tx.pacaCategory.update({
    where: { categoryId },
    data: { productId: product.productId },
  });

  const inventory = await tx.pacaInventory.findUnique({
    where: { categoryId },
  });
  const openingQty = (inventory?.available ?? 0) + (inventory?.reserved ?? 0);

  if (inventory && openingQty > 0) {
    const openingUnitCost = Number(inventory.totalCost) / openingQty;

    await tx.stockMovement.create({
      data: {
        productId: product.productId,
        warehouseId,
        quantity: openingQty,
        movementType: "entry",
        unitCost: openingUnitCost,
        notes: `paca:saldo-inicial categoria #${categoryId}`,
      },
    });

    await tx.stockLevel.upsert({
      where: {
        productId_warehouseId: { productId: product.productId, warehouseId },
      },
      create: {
        productId: product.productId,
        warehouseId,
        currentQuantity: openingQty,
      },
      update: {
        currentQuantity: { increment: openingQty },
        lastUpdated: new Date(),
      },
    });
  }

  return { productId: product.productId, warehouseId };
}

/**
 * Registra un StockMovement + actualiza StockLevel para el producto sombra
 * de una categoria de pacas. `allowNegative` siempre es true en el producto
 * sombra (el control real de disponibilidad es PacaInventory), asi que el
 * decremento de salida es directo, sin condicion atomica de suficiencia.
 */
export async function recordShadowMovement(
  tx: PrismaTx,
  params: {
    categoryId: number;
    quantity: number;
    unitCost: number;
    movementType: "entry" | "exit";
    reference: string;
    userId: number | null;
  }
): Promise<void> {
  const { categoryId, quantity, unitCost, movementType, reference, userId } = params;
  if (quantity <= 0) return;

  const { productId, warehouseId } = await ensureShadowProduct(tx, categoryId);

  await tx.stockMovement.create({
    data: {
      productId,
      warehouseId,
      quantity,
      movementType,
      unitCost,
      notes: reference,
      createdBy: userId,
    },
  });

  const delta = movementType === "entry" ? quantity : -quantity;
  await tx.stockLevel.upsert({
    where: { productId_warehouseId: { productId, warehouseId } },
    create: {
      productId,
      warehouseId,
      currentQuantity: delta,
    },
    update: {
      currentQuantity: { increment: delta },
      lastUpdated: new Date(),
    },
  });
}
