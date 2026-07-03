"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Heart, ShoppingCart } from "lucide-react";
import type {
  WebstoreCurrency,
  WebstoreProduct,
  WebstoreProductPresentation,
} from "@/lib/erp-client";
import { discountPct, fmt, stockInfo } from "@/lib/format";
import { useStore, useSyncCurrency, type CartLine } from "@/lib/store";
import { ProductImage } from "@/components/product-image";
import { QtyStepper } from "@/components/qty-stepper";

interface ProductDetailClientProps {
  product: WebstoreProduct;
  related: WebstoreProduct[];
  currency: WebstoreCurrency;
}

export function ProductDetailClient({
  product,
  related,
  currency,
}: ProductDetailClientProps) {
  useSyncCurrency(currency);
  const router = useRouter();
  const { state, toggleFav, addToCart, showToast } = useStore();

  const presentations = useMemo(
    () =>
      [...product.presentations].sort(
        (a, b) => Number(b.isBase) - Number(a.isBase)
      ),
    [product.presentations]
  );
  const hasSelector = presentations.length > 1;

  const [selected, setSelected] =
    useState<WebstoreProductPresentation | null>(presentations[0] ?? null);
  const [qty, setQty] = useState(1);

  const isFav = state.favs.includes(product.sku);
  const soldOut = product.stockAvailable <= 0;
  const stock = stockInfo(product.stockAvailable);
  const pct = discountPct(product);

  const isBaseSelected = selected == null || selected.isBase;
  const unitPrice = selected ? selected.retailPrice : product.price;
  const unitLabel = isBaseSelected ? "unidad" : selected.name.toLowerCase();
  const showCompare = isBaseSelected && product.compareAtPrice != null;

  const offerEndsAtLabel =
    product.offer?.endsAt != null
      ? new Date(product.offer.endsAt).toLocaleDateString("es-MX", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/catalogo");
  };

  const handleAdd = () => {
    if (soldOut) {
      showToast("Producto agotado");
      return;
    }
    const line: CartLine = {
      sku: selected?.sku ?? product.sku,
      productSku: product.sku,
      name: product.name,
      presentationName:
        selected && !selected.isBase ? selected.name : null,
      unitPrice,
      qty: 1,
      imageUrl: product.imageUrl,
      stockAvailable: product.stockAvailable,
      isCatchWeight: product.isCatchWeight,
    };
    addToCart(line, qty);
    showToast(`${product.name} añadido al carrito`);
    router.push("/carrito");
  };

  return (
    <div className="flex flex-1 flex-col bg-white md:mx-auto md:w-full md:max-w-5xl md:flex-row md:gap-8 md:bg-transparent md:px-6 md:py-8">
      <div className="relative flex h-[270px] items-center justify-center overflow-hidden bg-photo text-xs tracking-[1px] text-photo-fg md:h-auto md:flex-1 md:self-start md:rounded-2xl">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          sizes="(min-width: 768px) 50vw, 430px"
          label="FOTO PRODUCTO"
        />
        <button
          type="button"
          onClick={goBack}
          aria-label="Volver"
          className="absolute top-4 left-4 flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-white text-base text-navy shadow-[0_2px_8px_rgba(10,31,63,.14)] transition-colors hover:bg-app md:hidden"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          onClick={() => toggleFav(product.sku)}
          aria-label={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
          className={`absolute top-4 right-4 flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-white shadow-[0_2px_8px_rgba(10,31,63,.14)] transition-colors hover:bg-app ${
            isFav ? "text-fav" : "text-muted-2"
          }`}
        >
          <Heart className="h-[17px] w-[17px]" fill={isFav ? "currentColor" : "none"} />
        </button>
        {pct > 0 && (
          <span className="absolute bottom-3.5 left-4 rounded-lg bg-brand px-2.5 py-[5px] text-[11px] font-semibold text-white">
            −{pct}%
          </span>
        )}
      </div>

      <div className="flex-1 p-5 md:max-w-md md:p-0">
        <button
          type="button"
          onClick={goBack}
          className="mb-4 hidden items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-navy md:inline-flex"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
        {product.category && (
          <div className="text-xs font-semibold tracking-[.8px] text-brand-mid uppercase">
            {product.category}
          </div>
        )}
        <div className="mt-1.5 text-[21px] leading-[1.25] font-semibold text-navy md:text-[26px]">
          {product.name}
        </div>
        <div className="mt-2.5 flex items-baseline gap-2.5">
          <div className="text-2xl font-bold text-navy">{fmt(unitPrice, currency)}</div>
          {showCompare && product.compareAtPrice != null && (
            <div className="text-[15px] text-muted-2 line-through">
              {fmt(product.compareAtPrice, currency)}
            </div>
          )}
          <div className="text-[13px] text-muted">/ {unitLabel}</div>
        </div>
        {product.isCatchWeight && (
          <div className="mt-1 text-xs font-medium text-brand-mid">
            Precio estimado · el total se ajusta al peso real al preparar tu pedido
          </div>
        )}
        <div
          className="mt-1.5 text-xs font-medium"
          style={{ color: stock.color }}
        >
          {stock.label}
        </div>
        {product.offer && (
          <div className="mt-2.5 rounded-xl bg-chip px-3.5 py-2.5">
            <div className="text-[13px] font-semibold text-brand">
              {product.offer.name}
            </div>
            {offerEndsAtLabel && (
              <div className="mt-0.5 text-[11.5px] text-brand-mid">
                Termina el {offerEndsAtLabel}
              </div>
            )}
          </div>
        )}
        {product.description && (
          <div className="mt-3 text-sm leading-[1.55] text-ink-soft">
            {product.description}
          </div>
        )}

        {hasSelector && (
          <div className="mt-5">
            <div className="mb-2.5 text-[13.5px] font-semibold text-navy">
              Presentación
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {presentations.map((pres) => {
                const active = selected?.sku === pres.sku;
                return (
                  <button
                    key={pres.sku}
                    type="button"
                    onClick={() => setSelected(pres)}
                    className={`flex-none rounded-full border px-[15px] py-2 text-[13px] font-medium transition-colors ${
                      active
                        ? "border-brand bg-brand text-white"
                        : "border-line bg-white text-ink-soft hover:border-brand-mid"
                    }`}
                  >
                    {pres.name} · {fmt(pres.retailPrice, currency)}
                  </button>
                );
              })}
            </div>
            {selected?.wholesalePrice != null && (
              <div className="mt-1.5 text-xs text-muted">
                Mayoreo: {fmt(selected.wholesalePrice, currency)}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center gap-4">
          <div className="text-[13.5px] font-semibold text-navy">Cantidad</div>
          <QtyStepper
            qty={qty}
            onInc={() => setQty(qty + 1)}
            onDec={() => setQty(Math.max(1, qty - 1))}
            size="lg"
          />
        </div>

        {related.length > 0 && (
          <>
            <div className="mt-[22px] mb-2.5 text-sm font-semibold text-navy">
              También te puede interesar
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {related.map((r) => (
                <Link
                  key={r.sku}
                  href={`/producto/${encodeURIComponent(r.sku)}`}
                  className="w-[130px] flex-none overflow-hidden rounded-[13px] bg-app transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(10,31,63,.1)]"
                >
                  <div className="relative flex h-[76px] items-center justify-center bg-photo text-[9.5px] tracking-[.5px] text-photo-fg">
                    <ProductImage src={r.imageUrl} alt={r.name} sizes="130px" />
                  </div>
                  <div className="px-2.5 pt-[9px] pb-[11px]">
                    <div className="min-h-[30px] text-[11.5px] leading-[1.3] font-medium text-ink">
                      {r.name}
                    </div>
                    <div className="mt-1 text-[13px] font-bold text-navy">
                      {fmt(r.price, currency)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-line-2 bg-white px-5 pt-4 pb-6 md:static md:mt-6 md:rounded-2xl md:border md:border-line md:shadow-[0_3px_12px_rgba(10,31,63,.05)]">
        <div className="flex-1">
          <div className="text-xs text-muted">Total</div>
          <div className="text-[19px] font-bold text-navy">
            {fmt(unitPrice * qty, currency)}
          </div>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className={`flex items-center gap-2 rounded-[13px] px-[26px] py-3.5 text-[14.5px] font-semibold text-white transition-colors ${
            soldOut ? "bg-disabled" : "grad-cta hover:opacity-90"
          }`}
        >
          {soldOut ? null : <ShoppingCart className="h-[17px] w-[17px]" />}
          {soldOut ? "Agotado" : "Añadir al carrito"}
        </button>
      </div>
    </div>
  );
}
