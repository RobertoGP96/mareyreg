"use client";

import Link from "next/link";
import { Repeat2, Truck } from "lucide-react";
import type { WebstoreCurrency, WebstoreProduct } from "@/lib/erp-client";
import { STORE_NAME } from "@/lib/config";
import { discountPct, fmt } from "@/lib/format";
import { useSyncCurrency } from "@/lib/store";
import { FREE_SHIPPING_TARGET } from "@/lib/cart-totals";
import { ProductCarousel } from "@/components/product-carousel";
import { ButtonLink } from "@/components/ui/button";

// El bloque de oferta es un <Link> que envuelve toda la fila: su CTA no puede
// ser otro <ButtonLink> anidado, así que replica el aspecto de `soft` en un
// <span>. El resto de la home sí usa el componente.
const SOFT_CTA =
  "inline-flex items-center justify-center gap-2 bg-surface px-5 py-3 text-[11.5px] font-bold tracking-[.16em] text-navy-900 uppercase transition-colors duration-150 group-hover:bg-navy-900 group-hover:text-canvas";

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
      <section className="border-b border-line px-5 pt-[58px] pb-[52px] text-center md:px-10 md:pt-[86px] md:pb-[76px]">
        <p className="eyebrow">Bienvenido a {STORE_NAME}</p>
        <h1 className="font-display mx-auto mt-6 max-w-[840px] text-[42px] leading-[1.04] text-balance text-navy-900 md:text-[66px]">
          Todo lo que necesitas, en un solo lugar
        </h1>
        <p className="mx-auto mt-5 max-w-[470px] text-[14px] leading-[1.65] text-pretty text-slate-500">
          Despensa escogida pieza a pieza, marcas de confianza y precios
          claros. Elige con calma y te lo llevamos a casa.
        </p>
        <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-5">
          <ButtonLink href="/catalogo" variant="solid" size="lg">
            Ver el catálogo
          </ButtonLink>
          <ButtonLink href="/catalogo" size="lg">
            Buscar productos
          </ButtonLink>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="border-b border-line px-5 py-12 md:px-10 md:py-16">
          <p className="eyebrow">Secciones</p>
          <h2 className="font-display mt-4 text-[26px] leading-none text-navy-900 md:text-[32px]">
            Explora por categoría
          </h2>
          <div className="mt-8 overflow-hidden">
            <div className="-mr-px -mb-px grid grid-cols-2 md:grid-cols-4">
              {categories.map((cat) => (
                <Link
                  key={cat}
                  href={`/catalogo?cat=${encodeURIComponent(cat)}`}
                  className="nav-label flex min-h-[92px] items-end border-r border-b border-line-soft px-5 py-5 text-slate-400 transition-colors duration-150 hover:bg-hover hover:text-navy-900"
                >
                  {cat}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {offer && (
        <Link
          href="/catalogo?ofertas=1"
          className="group block border-b border-line px-5 py-12 transition-colors duration-150 hover:bg-hover md:px-10 md:py-14"
        >
          <div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between md:gap-10">
            <div className="min-w-0">
              <p className="eyebrow">Oferta de la semana</p>
              <p className="font-display mt-4 max-w-[560px] text-[26px] leading-[1.15] text-navy-900 md:text-[32px]">
                {offer.name}
              </p>
              <p className="tabular mt-3 text-[13.5px] leading-[1.65] text-slate-500">
                −{discountPct(offer)}% por tiempo limitado
              </p>
            </div>
            <span className={`${SOFT_CTA} flex-none`}>Ver oferta</span>
          </div>
        </Link>
      )}

      <ProductCarousel
        eyebrow="Selección"
        title="Destacados"
        products={highlighted}
        viewAllHref="/catalogo?destacados=1"
        eagerImages
        className="border-b border-line py-12 md:py-16"
      />

      <ProductCarousel
        eyebrow="Novedades"
        title="Recién añadidos"
        products={newest}
        viewAllHref="/catalogo"
        className="border-b border-line py-12 md:py-16"
      />

      <section className="px-5 py-12 md:px-10 md:py-16">
        <p className="eyebrow">Cómo compramos</p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2">
          <div className="border-t border-line-soft py-7 sm:pr-10">
            <Repeat2 className="h-4 w-4 text-slate-400" strokeWidth={1.6} />
            <h3 className="mt-4 text-[16px] leading-[1.35] font-semibold text-ink">
              Por mayor
            </h3>
            <p className="mt-2 text-[13.5px] leading-[1.65] text-pretty text-slate-500">
              Precios especiales por caja y paca.
            </p>
          </div>
          <div className="border-t border-line-soft py-7 sm:border-l sm:pl-10">
            <Truck className="h-4 w-4 text-slate-400" strokeWidth={1.6} />
            <h3 className="mt-4 text-[16px] leading-[1.35] font-semibold text-ink">
              Envío gratis
            </h3>
            <p className="tabular mt-2 text-[13.5px] leading-[1.65] text-pretty text-slate-500">
              En pedidos desde {fmt(FREE_SHIPPING_TARGET, currency)}.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
