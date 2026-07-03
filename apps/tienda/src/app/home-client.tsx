"use client";

import Link from "next/link";
import { Heart, Repeat2, Search, ShoppingCart, Truck } from "lucide-react";
import type { WebstoreCurrency, WebstoreProduct } from "@/lib/erp-client";
import { STORE_NAME } from "@/lib/config";
import { categoryIcon } from "@/lib/category-icons";
import { discountPct, fmt } from "@/lib/format";
import { cartCount, useStore, useSyncCurrency } from "@/lib/store";
import { FREE_SHIPPING_TARGET } from "@/lib/cart-totals";
import { ProductCarousel } from "@/components/product-carousel";

function bestOffer(products: WebstoreProduct[]): WebstoreProduct | null {
  const offers = products.filter((p) => discountPct(p) > 0);
  if (offers.length === 0) return null;
  return offers.reduce((best, p) =>
    discountPct(p) > discountPct(best) ? p : best
  );
}

export function HomeClient({
  products,
  currency,
}: {
  products: WebstoreProduct[];
  currency: WebstoreCurrency;
}) {
  useSyncCurrency(currency);
  const { state } = useStore();
  const count = cartCount(state);

  const categories = Array.from(
    new Set(
      products
        .map((p) => p.category)
        .filter((c): c is string => c != null && c.length > 0)
    )
  ).slice(0, 4);

  const offer = bestOffer(products);
  const featured = products.filter((p) => p.featured);
  const highlighted =
    featured.length > 0 ? featured.slice(0, 10) : products.slice(0, 8);
  const newest = [...products]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 8);

  return (
    <div className="flex flex-1 flex-col">
      <div className="grad-header anim-fade-up rounded-b-[26px] px-5 pt-[22px] pb-[58px] text-white md:mt-6 md:rounded-[26px] md:px-10 md:pt-9 md:pb-[74px]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium tracking-[.8px] text-[#7FA8E8]">
              BIENVENIDO A
            </div>
            <div className="mt-0.5 text-xl font-bold tracking-[-0.3px] md:text-2xl">
              {STORE_NAME}
            </div>
          </div>
          <div className="flex gap-2.5 md:hidden">
            <Link
              href="/favoritos"
              aria-label="Favoritos"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/0 bg-white/0 transition-colors hover:bg-white/20"
            >
              <Heart className="h-[18px] w-[18px]" />
            </Link>
            <Link
              href="/carrito"
              aria-label="Carrito"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 transition-colors hover:bg-white/20"
            >
              <ShoppingCart className="h-[18px] w-[18px]" />
              {count > 0 && (
                <span className="absolute -top-[5px] -right-[5px] flex h-[19px] min-w-[19px] items-center justify-center rounded-[10px] bg-brand-light px-[5px] text-[11px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
        <div className="mt-[18px] text-[25px] leading-[1.22] font-semibold md:mt-6 md:max-w-2xl md:text-[38px]">
          Todo lo que necesitas,
          <br />
          <span className="text-brand-soft">en un solo lugar.</span>
        </div>
        <Link
          href="/catalogo?focus=1"
          className="mt-[18px] flex items-center gap-2.5 rounded-[14px] border border-white/15 bg-white/10 px-[15px] py-[13px] text-sm text-white/60 transition-colors hover:border-white/30 hover:bg-white/15 md:mt-6 md:max-w-xl"
        >
          <Search className="h-4 w-4" /> Buscar productos…
        </Link>
      </div>

      {categories.length > 0 && (
        <div
          className="anim-fade-up -mt-[30px] grid gap-2.5 px-5 [animation-delay:60ms] md:-mt-[38px] md:gap-4 md:px-10"
          style={{
            gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))`,
          }}
        >
          {categories.map((cat) => {
            const Icon = categoryIcon(cat);
            return (
              <Link
                key={cat}
                href={`/catalogo?cat=${encodeURIComponent(cat)}`}
                className="flex flex-col items-center gap-[7px] rounded-[14px] bg-white px-1.5 py-[13px] shadow-[0_4px_14px_rgba(10,31,63,.08)] transition-[transform,box-shadow] duration-200 hover:shadow-[0_10px_24px_rgba(10,31,63,.14)] motion-safe:hover:-translate-y-0.5 md:flex-row md:justify-center md:gap-3 md:py-[18px]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-chip text-brand">
                  <Icon className="h-[17px] w-[17px]" />
                </div>
                <div className="text-center text-[10.5px] font-medium text-[#33415A] md:text-[13px]">
                  {cat}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {offer && (
        <Link
          href="/catalogo?ofertas=1"
          className="grad-offer anim-fade-up relative mx-5 mt-5 block overflow-hidden rounded-[18px] p-5 text-white transition-[transform,box-shadow] duration-200 hover:shadow-[0_12px_30px_rgba(20,65,127,.35)] motion-safe:hover:-translate-y-0.5 [animation-delay:120ms] md:mx-10 md:mt-7 md:p-8"
        >
          <div className="absolute -top-[30px] -right-[30px] h-[130px] w-[130px] rounded-full bg-white/8 md:h-[190px] md:w-[190px]" />
          <div className="absolute right-5 -bottom-[46px] h-[100px] w-[100px] rounded-full bg-white/6 md:right-24" />
          <div className="text-[11px] font-semibold tracking-[1.2px] text-[#BFDBFE] uppercase">
            Oferta de la semana
          </div>
          <div className="mt-1.5 mb-3 text-xl leading-[1.25] font-bold md:max-w-xl md:text-[26px]">
            {offer.name}
            <br />−{discountPct(offer)}% por tiempo limitado
          </div>
          <div className="inline-block rounded-[10px] bg-white px-4 py-[9px] text-[13px] font-semibold text-brand">
            Ver oferta
          </div>
        </Link>
      )}

      <ProductCarousel
        title="Destacados"
        products={highlighted}
        viewAllHref="/catalogo?destacados=1"
        eagerImages
        className="anim-fade-up pt-[22px] [animation-delay:180ms] md:pt-8"
      />

      <ProductCarousel
        title="Recién añadidos"
        products={newest}
        viewAllHref="/catalogo"
        className="anim-fade-up [animation-delay:220ms]"
      />

      <div className="anim-fade-up mx-5 mb-[22px] grid grid-cols-2 gap-3 [animation-delay:260ms] md:mx-10 md:mb-8 md:gap-5">
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-3.5 shadow-[0_3px_12px_rgba(10,31,63,.06)] md:flex-row md:items-center md:gap-4 md:p-6">
          <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] bg-chip text-brand">
            <Repeat2 className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-navy md:text-[15px]">
              Por mayor
            </div>
            <div className="text-[11.5px] leading-[1.4] text-muted md:text-[13px]">
              Precios especiales por caja y paca
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-3.5 shadow-[0_3px_12px_rgba(10,31,63,.06)] md:flex-row md:items-center md:gap-4 md:p-6">
          <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] bg-chip text-brand">
            <Truck className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-navy md:text-[15px]">
              Envío gratis
            </div>
            <div className="text-[11.5px] leading-[1.4] text-muted md:text-[13px]">
              En pedidos desde {fmt(FREE_SHIPPING_TARGET, state.currency)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
