import { db } from "@/lib/db";

export interface AbcRow {
  productId: number;
  name: string;
  revenue: number;
  qty: number;
  cumulativeRevenue: number;
  cumulativePct: number;
  abcClass: "A" | "B" | "C";
}

/**
 * Clasifica productos en A (80% ingresos), B (15% siguientes) y C (ultimo 5%)
 * segun las ventas (InvoiceLine) en el periodo.
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
    };
  });
}
