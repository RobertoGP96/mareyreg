import { FREE_SHIPPING_TARGET, SHIPPING_COST } from "@/lib/config";
import type { WebstoreCurrency } from "@/lib/erp-client";
import { DEFAULT_CURRENCY, fmt } from "@/lib/format";
import type { CartLine } from "@/lib/store";

export { FREE_SHIPPING_TARGET, SHIPPING_COST };
export const COUPON_CODE = "AZUL10";
export const COUPON_RATE = 0.1;

export interface CartTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  freeShipping: boolean;
  shippingPct: number;
}

/**
 * Importe de una línea: para líneas con piezas elegidas es la suma de los
 * precios por pieza que YA redondeó el ERP (nunca se recalcula pricePerKg ×
 * peso aquí — coherencia de redondeo centavo a centavo con la factura);
 * para el resto, unitPrice × qty.
 */
export function lineTotal(line: CartLine): number {
  if (line.pieces?.length) {
    return line.pieces.reduce((sum, p) => sum + (p.price ?? 0), 0);
  }
  return line.unitPrice * line.qty;
}

export function computeTotals(
  lines: readonly CartLine[],
  options: { couponApplied: boolean; pickup: boolean }
): CartTotals {
  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const discount = options.couponApplied ? subtotal * COUPON_RATE : 0;
  const freeShipping = subtotal >= FREE_SHIPPING_TARGET;
  const shipping = options.pickup || freeShipping ? 0 : SHIPPING_COST;
  const total = subtotal - discount + shipping;
  const shippingPct = Math.min(
    100,
    Math.round((subtotal / FREE_SHIPPING_TARGET) * 100)
  );
  return { subtotal, discount, shipping, total, freeShipping, shippingPct };
}

export function shippingMessage(
  totals: CartTotals,
  currency: WebstoreCurrency = DEFAULT_CURRENCY
): string {
  return totals.freeShipping
    ? "¡Tienes envío gratis!"
    : `Te faltan ${fmt(FREE_SHIPPING_TARGET - totals.subtotal, currency)} para envío gratis`;
}
