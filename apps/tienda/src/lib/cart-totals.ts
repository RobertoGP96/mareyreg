import { fmt } from "@/lib/format";
import type { CartLine } from "@/lib/store";

export const FREE_SHIPPING_TARGET = 100;
export const SHIPPING_COST = 5;
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

export function computeTotals(
  lines: readonly CartLine[],
  options: { couponApplied: boolean; pickup: boolean }
): CartTotals {
  const subtotal = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.qty,
    0
  );
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

export function shippingMessage(totals: CartTotals): string {
  return totals.freeShipping
    ? "¡Tienes envío gratis!"
    : `Te faltan ${fmt(FREE_SHIPPING_TARGET - totals.subtotal)} para envío gratis`;
}
