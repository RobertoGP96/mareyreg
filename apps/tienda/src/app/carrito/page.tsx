"use client";

import { useState } from "react";
import { ShoppingBag, X } from "lucide-react";
import {
  COUPON_CODE,
  computeTotals,
  lineTotal,
  shippingMessage,
} from "@/lib/cart-totals";
import { fmt } from "@/lib/format";
import { cartLines, useStore } from "@/lib/store";
import { EmptyState } from "@/components/empty-state";
import { ProductImage } from "@/components/product-image";
import { QtyStepper } from "@/components/qty-stepper";
import { ScreenHeader } from "@/components/screen-header";
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
      <ScreenHeader eyebrow="Tu selección" title="Carrito" />

      {lines.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          eyebrow="Sin artículos"
          title="Tu carrito está vacío"
          description="Explora el catálogo y añade productos."
          ctaLabel="Ir al catálogo"
          ctaHref="/catalogo"
        />
      ) : (
        <div className="mx-auto w-full max-w-[1120px] px-5 pb-14 md:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
          <div className="divide-y divide-line-soft rounded-lg bg-canvas shadow-card">
            {lines.map((line) => (
              <div key={line.sku} className="flex gap-4 p-4 md:p-5">
                <div className="relative h-[76px] w-[76px] flex-none overflow-hidden rounded-md bg-surface">
                  <span className="absolute inset-0 flex items-center justify-center">
                    <ProductImage
                      src={line.imageUrl}
                      alt={line.name}
                      sizes="76px"
                    />
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {(line.modelLabel || line.presentationName) && (
                    <span className="eyebrow truncate">
                      {[line.modelLabel, line.presentationName]
                        .filter(Boolean)
                        .join(" · ")}
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
                          className="tabular inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-line px-2.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:border-danger hover:text-danger"
                        >
                          {p.weightKg.toFixed(2)} kg · {fmt(p.price, currency)}
                          <X className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    line.isCatchWeight && (
                      <p className="text-[12px] text-slate-400">
                        Precio estimado · se ajusta al peso real
                      </p>
                    )
                  )}

                  <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                    <span className="tabular text-[15px] font-bold text-navy-900">
                      {fmt(lineTotal(line), currency)}
                    </span>
                    <div className="flex items-center gap-3">
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
                        className="hover:text-danger"
                      >
                        Quitar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="mt-6 rounded-lg bg-canvas p-5 shadow-card md:p-6 lg:mt-0 lg:sticky lg:top-[84px]">
            <p className="eyebrow">Resumen</p>

            <div className="mt-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[12.5px] text-slate-500">
                  {shippingMessage(totals, currency)}
                </span>
                <span className="tabular text-[12px] font-semibold text-navy-900">
                  {totals.shippingPct}%
                </span>
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-navy-700 transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${totals.shippingPct}%` }}
                />
              </div>
            </div>

            <dl className="mt-5 flex flex-col gap-2.5">
              <div className="flex justify-between text-[13.5px]">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="tabular font-medium text-ink">
                  {fmt(totals.subtotal, currency)}
                </dd>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-[13.5px]">
                  <dt className="text-ok">Descuento {COUPON_CODE} (−10%)</dt>
                  <dd className="tabular font-medium text-ok">
                    −{fmt(totals.discount, currency)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between text-[13.5px]">
                <dt className="text-slate-500">Envío</dt>
                <dd className="tabular font-medium text-ink">
                  {totals.shipping === 0
                    ? "Gratis"
                    : fmt(totals.shipping, currency)}
                </dd>
              </div>
              <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3 text-[15px] font-semibold">
                <dt className="text-ink">Total</dt>
                <dd className="tabular text-[20px] font-bold text-navy-900">
                  {fmt(totals.total, currency)}
                </dd>
              </div>
            </dl>

            <div className="mt-5">
              <label
                htmlFor="coupon"
                className="mb-1.5 block text-[12px] font-semibold text-slate-500"
              >
                Código de descuento
              </label>
              <div className="flex gap-2">
                <Input
                  id="coupon"
                  variant="box"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder={COUPON_CODE}
                  autoComplete="off"
                  className="flex-1"
                />
                <Button
                  variant="soft"
                  onClick={handleCoupon}
                  className="flex-none"
                >
                  Aplicar
                </Button>
              </div>
            </div>

            <ButtonLink
              href="/checkout"
              variant="solid"
              size="lg"
              className="mt-5 w-full"
            >
              Ir a pagar
            </ButtonLink>
          </aside>
        </div>
      )}
    </div>
  );
}
