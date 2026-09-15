"use client";

import Link from "next/link";
import { ArrowRight, Repeat2, Truck } from "lucide-react";
import type { WebstoreCurrency, WebstoreProduct } from "@/lib/erp-client";
import { STORE_NAME } from "@/lib/config";
import { discountPct, fmt } from "@/lib/format";
import {
  entryIsFeatured,
  entryNewestCreatedAt,
  groupCatalog,
  type CatalogEntry,
} from "@/lib/model-groups";
import { useSyncCurrency } from "@/lib/store";
import { FREE_SHIPPING_TARGET } from "@/lib/cart-totals";
import { ProductCarousel } from "@/components/product-carousel";
import { ButtonLink } from "@/components/ui/button";

function bestOffer(products: WebstoreProduct[]): WebstoreProduct | null {
  const offers = products.filter((p) => discountPct(p) > 0);
  if (offers.length === 0) return null;
  return offers.reduce((best, p) =>
    discountPct(p) > discountPct(best) ? p : best
  );
}

const PERKS = [
  {
    icon: Repeat2,
    title: "Por mayor",
    description: "Precios especiales por caja y paca.",
  },
  {
    icon: Truck,
    title: "Envío gratis",
    description: null,
  },
] as const;

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
  // Se recorta por entrada (card), no por producto: así un grupo de modelos
  // nunca llega partido al carrusel ni cuenta como varias cards.
  const entries = groupCatalog(products);
  const flatten = (list: CatalogEntry[]) => list.flatMap((e) => e.models);
  const featured = entries.filter(entryIsFeatured);
  const highlighted = flatten(
    featured.length > 0 ? featured.slice(0, 10) : entries.slice(0, 8)
  );
  const newest = flatten(
    [...entries]
      .sort((a, b) =>
        entryNewestCreatedAt(b).localeCompare(entryNewestCreatedAt(a))
      )
      .slice(0, 8)
  );

  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-line bg-canvas px-5 pt-14 pb-12 text-center md:px-10 md:pt-[72px] md:pb-16">
        <p className="eyebrow text-[12px] tracking-[.12em] text-gold-600">
          Bienvenido a {STORE_NAME}
        </p>
        <h1 className="font-display mx-auto mt-5 max-w-[760px] text-[34px] leading-[1.05] text-balance text-navy-900 md:text-[52px]">
          Todo lo que necesitas, en un solo lugar
        </h1>
        <p className="mx-auto mt-4 max-w-[470px] text-[14px] leading-[1.65] text-pretty text-slate-500">
          Despensa escogida pieza a pieza, marcas de confianza y precios
          claros. Elige con calma y te lo llevamos a casa.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-3.5">
          <ButtonLink href="/catalogo" variant="solid" size="lg">
            Ver el catálogo
          </ButtonLink>
          <ButtonLink href="/catalogo" size="lg">
            Buscar productos
          </ButtonLink>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-10 px-5 py-10 md:px-6 md:py-11">
        {categories.length > 0 && (
          <section>
            <p className="eyebrow">Secciones</p>
            <h2 className="font-display mt-1.5 text-[20px] leading-tight text-ink md:text-[24px]">
              Explora por categoría
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {categories.map((cat) => (
                <Link
                  key={cat}
                  href={`/catalogo?cat=${encodeURIComponent(cat)}`}
                  className="group flex min-h-[88px] items-end justify-between gap-3 rounded-lg bg-canvas p-4 shadow-card transition-[box-shadow,transform] duration-200 hover:shadow-float motion-safe:hover:-translate-y-0.5"
                >
                  <span className="min-w-0 truncate text-[14px] font-semibold text-ink">
                    {cat}
                  </span>
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-tint text-navy-700 transition-colors duration-150 group-hover:bg-navy-700 group-hover:text-on-brand">
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {offer && (
          <Link
            href="/catalogo?ofertas=1"
            className="group relative block overflow-hidden rounded-lg bg-navy-700 px-6 py-8 text-on-brand shadow-float transition-transform duration-200 motion-safe:hover:-translate-y-0.5 md:px-10 md:py-10"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-gold-500/25 blur-3xl"
            />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-10">
              <div className="min-w-0">
                <p className="eyebrow text-gold-500">Oferta de la semana</p>
                <p className="font-display mt-3 max-w-[560px] text-[24px] leading-[1.15] text-balance md:text-[30px]">
                  {offer.name}
                </p>
                <p className="tabular mt-2.5 text-[13.5px] text-on-brand/80">
                  −{discountPct(offer)}% por tiempo limitado
                </p>
              </div>
              <span className="inline-flex flex-none items-center justify-center gap-2 self-start rounded-full bg-canvas px-[22px] py-3 text-[14px] font-semibold text-navy-700 transition-colors duration-150 group-hover:bg-tint md:self-auto">
                Ver oferta
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </span>
            </div>
          </Link>
        )}

        <ProductCarousel
          eyebrow="Selección"
          title="Destacados"
          products={highlighted}
          viewAllHref="/catalogo?destacados=1"
          eagerImages
        />

        <ProductCarousel
          eyebrow="Novedades"
          title="Recién añadidos"
          products={newest}
          viewAllHref="/catalogo"
        />

        <section>
          <p className="eyebrow">Cómo compramos</p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
            {PERKS.map((perk) => {
              const Icon = perk.icon;
              return (
                <div
                  key={perk.title}
                  className="flex gap-4 rounded-lg bg-canvas p-5 shadow-card"
                >
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-tint text-navy-700">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-ink">
                      {perk.title}
                    </h3>
                    <p className="tabular mt-1 text-[13.5px] leading-[1.6] text-pretty text-slate-500">
                      {perk.description ??
                        `En pedidos desde ${fmt(FREE_SHIPPING_TARGET, currency)}.`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
