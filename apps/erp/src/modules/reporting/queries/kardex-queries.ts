import { db } from "@/lib/db";

export interface KardexRow {
  createdAt: Date;
  movementType: string;
  quantity: number;
  signedDelta: number;
  unitCost: number | null;
  referenceDoc: string | null;
  notes: string | null;
  warehouseName: string;
  balance: number;
}

export async function getKardex(
  productId: number,
  filter?: { warehouseId?: number; from?: Date; to?: Date }
): Promise<KardexRow[]> {
  const movements = await db.stockMovement.findMany({
    where: {
      productId,
      ...(filter?.warehouseId && { warehouseId: filter.warehouseId }),
      ...(filter?.from && { createdAt: { gte: filter.from } }),
      ...(filter?.to && { createdAt: { lte: filter.to } }),
    },
    include: { warehouse: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  let balance = 0;
  const rows: KardexRow[] = [];
  for (const m of movements) {
    const q = Number(m.quantity);
    let delta = 0;
    if (m.movementType === "entry") delta = q;
    else if (m.movementType === "exit") delta = -q;
    else if (m.movementType === "transfer") {
      // Dos filas se generan por transferencia; pero al filtrar por almac\u00e9n, vemos solo una direccion.
      // Inferimos el signo: si las notas contienen "->" es salida, "<-" es entrada.
      delta = m.notes?.includes("<-") ? q : -q;
    } else if (m.movementType === "adjustment") {
      delta = m.notes?.toLowerCase().includes("negativ") ? -q : q;
    }

    // Si no se filtra por almac\u00e9n, el balance no es acumulable globalmente;
    // as\u00ed que en ese caso reseteamos balance a ignorar.
    balance += delta;

    rows.push({
      createdAt: m.createdAt,
      movementType: m.movementType,
      quantity: q,
      signedDelta: delta,
      unitCost: m.unitCost != null ? Number(m.unitCost) : null,
      referenceDoc: m.referenceDoc,
      notes: m.notes,
      warehouseName: m.warehouse.name,
      balance,
    });
  }

  return rows;
}
