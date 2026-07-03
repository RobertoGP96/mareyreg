"use client";

import Link from "next/link";
import type { WebstoreProduct } from "@/lib/erp-client";
import { STORE_NAME } from "@/lib/config";
import { categoryIcon } from "@/lib/category-icons";
import { discountPct } from "@/lib/format";
import { cartCount, useStore } from "@/lib/store";
import { ProductCard } from "@/components/product-card";

function bestOffer(products: WebstoreProduct[]): WebstoreProduct | null {
  const offers = products.filter((p) => discountPct(p) > 0);
  if (offers.length === 0) return null;
  return offers.reduce((best, p) =>
    discountPct(p) > discountPct(best) ? p : best
  );
}

export function HomeClient({ products }: { products: WebstoreProduct[] }) {
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
  const highlighted = featured.length > 0 ? featured : products.slice(0, 4);

  return (
    <div className="flex flex-1 flex-col">
      <div className="grad-header rounded-b-[26px] px-5 pt-[22px] pb-[58px] text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium tracking-[.8px] text-[#7FA8E8]">
              BIENVENIDO A
            </div>
            <div className="mt-0.5 text-xl font-bold tracking-[-0.3px]">
              {STORE_NAME}
            </div>
          </div>
          <div className="flex gap-2.5">
            <Link
              href="/favoritos"
              aria-label="Favoritos"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-base"
            >
              ♡
            </Link>
            <Link
              href="/carrito"
              aria-label="Carrito"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-base"
            >
              🛒
              {count > 0 && (
                <span className="absolute -top-[5px] -right-[5px] flex h-[19px] min-w-[19px] items-center justify-center rounded-[10px] bg-brand-light px-[5px] text-[11px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
        <div className="mt-[18px] text-[25px] leading-[1.22] font-semibold">
          Todo lo que necesitas,
          <br />
          <span className="text-brand-soft">en un solo lugar.</span>
        </div>
        <Link
          href="/catalogo?focus=1"
          className="mt-[18px] flex items-center gap-2.5 rounded-[14px] border border-white/15 bg-white/10 px-[15px] py-[13px] text-sm text-white/60"
        >
          <span>⌕</span> Buscar productos…
        </Link>
      </div>

      {categories.length > 0 && (
        <div
          className="-mt-[30px] grid gap-2.5 px-5"
          style={{
            gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))`,
          }}
        >
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/catalogo?cat=${encodeURIComponent(cat)}`}
              className="flex flex-col items-center gap-[7px] rounded-[14px] bg-white px-1.5 py-[13px] shadow-[0_4px_14px_rgba(10,31,63,.08)]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-chip text-[15px] text-brand">
                {categoryIcon(cat)}
              </div>
              <div className="text-center text-[10.5px] font-medium text-[#33415A]">
                {cat}
              </div>
            </Link>
          ))}
        </div>
      )}

      {offer && (
        <Link
          href="/catalogo?ofertas=1"
          className="grad-offer relative mx-5 mt-5 block overflow-hidden rounded-[18px] p-5 text-white"
        >
          <div className="absolute -top-[30px] -right-[30px] h-[130px] w-[130px] rounded-full bg-white/8" />
          <div className="absolute right-5 -bottom-[46px] h-[100px] w-[100px] rounded-full bg-white/6" />
          <div className="text-[11px] font-semibold tracking-[1.2px] text-[#BFDBFE] uppercase">
            Oferta de la semana
          </div>
          <div className="mt-1.5 mb-3 text-xl leading-[1.25] font-bold">
            {offer.name}
            <br />−{discountPct(offer)}% por tiempo limitado
          </div>
          <div className="inline-block rounded-[10px] bg-white px-4 py-[9px] text-[13px] font-semibold text-brand">
            Ver oferta
          </div>
        </Link>
      )}

      <div className="flex items-baseline justify-between px-5 pt-[22px] pb-2">
        <div className="text-base font-semibold text-navy">Destacados</div>
        <Link
          href="/catalogo"
          className="text-[13px] font-medium text-brand-mid"
        >
          Ver todo →
        </Link>
      </div>
      <div className="flex gap-3.5 overflow-x-auto px-5 pt-1.5 pb-5">
        {highlighted.map((product) => (
          <ProductCard key={product.sku} product={product} variant="carousel" />
        ))}
      </div>

      <div className="mx-5 mb-[22px] grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-3.5 shadow-[0_3px_12px_rgba(10,31,63,.06)]">
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-chip text-base text-brand">
            ⇄
          </div>
          <div className="text-[13px] font-semibold text-navy">Por mayor</div>
          <div className="text-[11.5px] leading-[1.4] text-muted">
            Precios especiales por caja y paca
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-3.5 shadow-[0_3px_12px_rgba(10,31,63,.06)]">
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-chip text-base text-brand">
            ➤
          </div>
          <div className="text-[13px] font-semibold text-navy">
            Envío gratis
          </div>
          <div className="text-[11.5px] leading-[1.4] text-muted">
            En pedidos desde $100
          </div>
        </div>
      </div>
    </div>
  );
}
