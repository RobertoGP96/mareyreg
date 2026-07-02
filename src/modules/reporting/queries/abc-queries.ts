import { db } from "@/lib/db";

export interface AbcRow {
  productId: number;
  name: string;
  revenue: number;
  qty: number;
  cumulativeRevenue: number;
  cumulativePct: number;
  abcClass: "A" | "B" | "C";
  isPaca: boolean;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Ventas de PacaSale en el periodo, agregadas por categoria y mapeadas al
 * productId sombra (PacaCategory.productId). Categorias sin producto sombra
 * (aun no vendidas desde que se agrego el espejo) se omiten: no tienen
 * StockMovement ni forma de aparecer en el kardex todavia.
 *
 * saleDate es un string "YYYY-MM-DD" (formato de <input type="date">), por
 * lo que el rango [from, to] se filtra como comparacion lexicografica de
 * strings directamente en la consulta (formato ISO es orden-estable).
 */
async function getPacaRevenueByShadowProduct(
  from: Date,
  to: Date
): Promise<Map<number, { name: string; revenue: number; qty: number }>> {
  const sales = await db.pacaSale.findMany({
    where: {
      saleDate: { gte: toDateOnly(from), lte: toDateOnly(to) },
      category: { productId: { not: null } },
    },
    include: { category: { select: { name: true, productId: true } } },
  });

  const byProduct = new Map<number, { name: string; revenue: number; qty: number }>();
  for (const s of sales) {
    if (!s.category.productId) continue;
    const rev = Number(s.salePrice);
    const cur = byProduct.get(s.category.productId) ?? {
      name: s.category.name,
      revenue: 0,
      qty: 0,
    };
    cur.revenue += rev;
    cur.qty += s.quantity;
    byProduct.set(s.category.productId, cur);
  }
  return byProduct;
}

/**
 * Clasifica productos en A (80% ingresos), B (15% siguientes) y C (ultimo 5%)
 * segun las ventas del periodo. Fusiona InvoiceLine (ventas de productos
 * regulares, qty*precio-descuento) con PacaSale (ventas de pacas, salePrice
 * ya es el total de la linea) mapeada al producto sombra de su categoria,
 * replicando la misma semantica de ingreso para que ambas fuentes compitan
 * en el mismo ranking ABC.
 */
export async function getAbcAnalysis(from: Date, to: Date): Promise<AbcRow[]> {
  const lines = await db.invoiceLine.findMany({
    where: {
      invoice: {
        status: { not: "cancelled" },
        issueDate: { gte: from, lte: to },
      },
    },
    include: { product: { select: { productId: true, name: true } } },
  });

  const byProduct = new Map<number, { name: string; revenue: number; qty: number }>();
  for (const l of lines) {
    const rev = Number(l.quantity) * Number(l.unitPrice) - Number(l.discount);
    const cur = byProduct.get(l.productId) ?? { name: l.product.name, revenue: 0, qty: 0 };
    cur.revenue += rev;
    cur.qty += Number(l.quantity);
    byProduct.set(l.productId, cur);
  }

  const pacaByProduct = await getPacaRevenueByShadowProduct(from, to);
  const pacaProductIds = new Set(pacaByProduct.keys());
  for (const [productId, pacaAgg] of pacaByProduct) {
    const cur = byProduct.get(productId) ?? { name: pacaAgg.name, revenue: 0, qty: 0 };
    cur.revenue += pacaAgg.revenue;
    cur.qty += pacaAgg.qty;
    byProduct.set(productId, cur);
  }

  const sorted = Array.from(byProduct.entries())
    .map(([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  const total = sorted.reduce((s, p) => s + p.revenue, 0);
  if (total === 0) return [];

  let cum = 0;
  return sorted.map((p) => {
    cum += p.revenue;
    const pct = (cum / total) * 100;
    const abcClass: "A" | "B" | "C" = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
    return {
      productId: p.productId,
      name: p.name,
      revenue: p.revenue,
      qty: p.qty,
      cumulativeRevenue: cum,
      cumulativePct: pct,
      abcClass,
      isPaca: pacaProductIds.has(p.productId),
    };
  });
}
