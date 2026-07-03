"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ShoppingCart, Trash2 } from "lucide-react";
import { COUPON_CODE, computeTotals, shippingMessage } from "@/lib/cart-totals";
import { fmt } from "@/lib/format";
import { cartLines, useStore } from "@/lib/store";
import { EmptyState } from "@/components/empty-state";
import { ProductImage } from "@/components/product-image";
import { QtyStepper } from "@/components/qty-stepper";
import { ScreenHeader } from "@/components/screen-header";

export default function CartPage() {
  const { state, incQty, decQty, removeLine, applyCoupon, showToast } =
    useStore();
  const [couponInput, setCouponInput] = useState("");

  const lines = cartLines(state);
  const totals = computeTotals(lines, {
    couponApplied: state.couponApplied,
    pickup: false,
  });
  const currency = state.currency;

  const handleCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      showToast("Escribe un código");
      return;
    }
    if (code === COUPON_CODE) {
      applyCoupon();
      showToast("Cupón aplicado: −10%");
    } else {
      showToast("Cupón no válido");
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Carrito" />

      {lines.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Tu carrito está vacío"
          description="Explora el catálogo y añade productos."
          ctaLabel="Ir al catálogo"
          ctaHref="/catalogo"
        />
      ) : (
        <div className="md:mx-auto md:w-full md:max-w-5xl md:flex-1 md:px-6 md:py-6">
          <div className="md:flex md:items-start md:gap-8">
          <div className="flex flex-1 flex-col gap-3 px-5 py-4 md:px-0 md:py-0">
            <div className="rounded-[14px] bg-white px-[15px] py-[13px] shadow-[0_3px_12px_rgba(10,31,63,.05)]">
              <div className="mb-2 flex justify-between text-xs">
                <span className="font-medium text-ink-soft">
                  {shippingMessage(totals, currency)}
                </span>
                <span className="font-semibold text-brand-mid">
                  {totals.shippingPct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-photo">
                <div
                  className="grad-progress h-full rounded transition-[width]"
                  style={{ width: `${totals.shippingPct}%` }}
                />
              </div>
            </div>

            {lines.map((line) => (
              <div
                key={line.sku}
                className="flex items-center gap-3 rounded-[15px] bg-white p-3 shadow-[0_3px_12px_rgba(10,31,63,.05)]"
              >
                <div className="relative flex h-[60px] w-[60px] flex-none items-center justify-center rounded-[11px] bg-photo text-[9px] tracking-[.5px] text-photo-fg">
                  <ProductImage
                    src={line.imageUrl}
                    alt={line.name}
                    sizes="60px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] leading-[1.3] font-medium text-ink">
                    {line.presentationName
                      ? `${line.name} — ${line.presentationName}`
                      : line.name}
                  </div>
                  <div className="mt-1 text-sm font-bold text-navy">
                    {fmt(line.unitPrice * line.qty, currency)}
                  </div>
                  {line.isCatchWeight && (
                    <div className="mt-0.5 text-[11px] text-brand-mid">
                      Precio estimado · se ajusta al peso real
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => removeLine(line.sku)}
                    aria-label="Eliminar del carrito"
                    className="text-muted-2 transition-colors hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <QtyStepper
                    qty={line.qty}
                    onInc={() => incQty(line.sku)}
                    onDec={() => decQty(line.sku)}
                  />
                </div>
              </div>
            ))}

            <div className="flex gap-2 rounded-[14px] bg-white p-1.5 shadow-[0_3px_12px_rgba(10,31,63,.05)]">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Código de descuento (ej. AZUL10)"
                className="flex-1 border-none bg-transparent px-3 py-2.5 text-[13px] text-ink"
              />
              <button
                type="button"
                onClick={handleCoupon}
                className="flex items-center rounded-[10px] bg-brand px-4 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-mid"
              >
                Aplicar
              </button>
            </div>
          </div>

          <div className="rounded-t-[22px] border-t border-line-2 bg-white px-5 pt-[18px] pb-6 md:sticky md:top-6 md:w-[360px] md:flex-none md:rounded-[22px] md:border md:border-line-2 md:px-5 md:pt-5">
            <div className="mb-1.5 flex justify-between text-[13.5px] text-ink-soft">
              <span>Subtotal</span>
              <span>{fmt(totals.subtotal, currency)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="mb-1.5 flex justify-between text-[13.5px] text-ok">
                <span>Descuento AZUL10 (−10%)</span>
                <span>−{fmt(totals.discount, currency)}</span>
              </div>
            )}
            <div className="mb-2.5 flex justify-between text-[13.5px] text-ink-soft">
              <span>Envío</span>
              <span>{totals.shipping === 0 ? "Gratis" : fmt(totals.shipping, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-dashed border-line pt-2.5 text-base font-bold text-navy">
              <span>Total</span>
              <span>{fmt(totals.total, currency)}</span>
            </div>
            <Link
              href="/checkout"
              className="grad-cta mt-4 flex items-center justify-center gap-2 rounded-[13px] p-[15px] text-center text-[15px] font-semibold text-white transition-colors hover:opacity-90"
            >
              Ir a pagar
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
