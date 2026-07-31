"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  COUPON_CODE,
  computeTotals,
  lineTotal,
  shippingMessage,
} from "@/lib/cart-totals";
import { fmt } from "@/lib/format";
import { cartLines, useStore } from "@/lib/store";
import { ProductImage } from "@/components/product-image";
import { QtyStepper } from "@/components/qty-stepper";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CartPage() {
  const {
    state,
    incQty,
    decQty,
    removeLine,
    removePiece,
    applyCoupon,
    showToast,
  } = useStore();
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
      <section className="border-b border-line px-5 pt-12 pb-9 md:px-10">
        <p className="eyebrow">Tu selección</p>
        <h1 className="font-display mt-4 text-[42px] leading-none text-navy-900 md:text-[56px]">
          Carrito
        </h1>
      </section>

      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-24 text-center md:px-10">
          <p className="eyebrow">Sin artículos</p>
          <p className="font-display mt-4 text-[32px] leading-none text-navy-900">
            Tu carrito está vacío
          </p>
          <p className="mt-4 max-w-[380px] text-[13.5px] leading-[1.65] text-pretty text-slate-500">
            Explora el catálogo y añade productos.
          </p>
          <ButtonLink href="/catalogo" className="mt-7">
            Ir al catálogo
          </ButtonLink>
        </div>
      ) : (
        <div className="flex flex-1 flex-col lg:flex-row lg:items-start">
          <div className="flex-1 lg:border-r lg:border-line">
            <div className="border-b border-line px-5 py-5 md:px-10">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[12.5px] text-slate-500">
                  {shippingMessage(totals, currency)}
                </span>
                <span className="tabular text-[11px] font-bold text-navy-900">
                  {totals.shippingPct}%
                </span>
              </div>
              <div className="mt-3 h-0.5 w-full bg-line">
                <div
                  className="h-0.5 bg-navy-900 transition-[width] duration-150"
                  style={{ width: `${totals.shippingPct}%` }}
                />
              </div>
            </div>

            {lines.map((line) => (
              <div
                key={line.sku}
                className="flex gap-4 border-b border-line-soft px-5 py-6 md:px-10"
              >
                <div className="relative h-[76px] w-[76px] flex-none overflow-hidden bg-surface text-[9px] tracking-[.22em] text-slate-300">
                  <span className="absolute inset-0 flex items-center justify-center">
                    <ProductImage
                      src={line.imageUrl}
                      alt={line.name}
                      sizes="76px"
                    />
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {line.presentationName && (
                    <span className="eyebrow truncate">
                      {line.presentationName}
                    </span>
                  )}
                  <h2 className="text-[15px] leading-[1.35] font-semibold text-ink">
                    {line.name}
                  </h2>

                  {line.pieces?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {line.pieces.map((p) => (
                        <button
                          key={p.pieceId}
                          type="button"
                          onClick={() => removePiece(line.sku, p.pieceId)}
                          aria-label={`Quitar pieza de ${p.weightKg.toFixed(2)} kg`}
                          title="Quitar esta pieza"
                          className="tabular inline-flex items-center gap-1.5 border border-line px-2 py-1 text-[10.5px] font-medium text-slate-500 transition-colors duration-150 hover:border-danger hover:text-danger"
                        >
                          {p.weightKg.toFixed(2)} kg · {fmt(p.price, currency)}
                          <X className="h-3.5 w-3.5" strokeWidth={1.6} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    line.isCatchWeight && (
                      <p className="text-[11.5px] text-slate-400">
                        Precio estimado · se ajusta al peso real
                      </p>
                    )
                  )}

                  <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                    <span className="tabular text-[15px] font-bold text-navy-900">
                      {fmt(lineTotal(line), currency)}
                    </span>
                    <div className="flex items-center gap-4">
                      {!line.pieces?.length && (
                        <QtyStepper
                          qty={line.qty}
                          onInc={() => incQty(line.sku)}
                          onDec={() => decQty(line.sku)}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(line.sku)}
                      >
                        Quitar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="px-5 py-8 md:px-10 lg:sticky lg:top-[78px] lg:w-[380px] lg:flex-none lg:px-8">
            <p className="eyebrow">Resumen</p>

            <dl className="mt-6">
              <div className="flex items-baseline justify-between gap-4 border-b border-line-soft py-3">
                <dt className="text-[13px] text-slate-500">Subtotal</dt>
                <dd className="tabular text-[13px] text-ink">
                  {fmt(totals.subtotal, currency)}
                </dd>
              </div>
              {totals.discount > 0 && (
                <div className="flex items-baseline justify-between gap-4 border-b border-line-soft py-3">
                  <dt className="text-[13px] text-ok">
                    Descuento {COUPON_CODE} (−10%)
                  </dt>
                  <dd className="tabular text-[13px] text-ok">
                    −{fmt(totals.discount, currency)}
                  </dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-4 border-b border-line py-3">
                <dt className="text-[13px] text-slate-500">Envío</dt>
                <dd className="tabular text-[13px] text-ink">
                  {totals.shipping === 0
                    ? "Gratis"
                    : fmt(totals.shipping, currency)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 pt-5">
                <dt className="text-[13px] font-semibold text-ink">Total</dt>
                <dd className="tabular text-[21px] font-bold text-navy-900">
                  {fmt(totals.total, currency)}
                </dd>
              </div>
            </dl>

            <div className="mt-9 border-t border-line pt-7">
              <label htmlFor="coupon" className="eyebrow">
                Código de descuento
              </label>
              <div className="mt-3 flex items-end gap-5">
                <Input
                  id="coupon"
                  variant="rule"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder={COUPON_CODE}
                  autoComplete="off"
                  className="flex-1"
                />
                <Button onClick={handleCoupon} className="flex-none">
                  Aplicar
                </Button>
              </div>
            </div>

            <ButtonLink
              href="/checkout"
              variant="solid"
              size="lg"
              className="mt-9 w-full"
            >
              Ir a pagar
            </ButtonLink>
          </aside>
        </div>
      )}
    </div>
  );
}
