"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { WebstoreProduct } from "@/lib/erp-client";
import { groupCatalog } from "@/lib/model-groups";
import { ProductCard } from "@/components/product-card";
import { cn } from "@/lib/utils";

interface ProductCarouselProps {
  title: string;
  products: WebstoreProduct[];
  viewAllHref?: string;
  className?: string;
  eyebrow?: string;
  /** true solo para el primer carrusel de la página: precarga las primeras imágenes (LCP). */
  eagerImages?: boolean;
}

const ARROW_CLASS =
  "flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-line bg-canvas text-slate-500 transition-colors duration-150 hover:border-navy-700 hover:text-navy-700 disabled:cursor-default disabled:opacity-40 disabled:hover:border-line disabled:hover:text-slate-500";

/**
 * Carrusel horizontal de productos con scroll-snap. En móvil se desliza con
 * el dedo; en desktop agrega flechas que se deshabilitan en los extremos.
 *
 * Se coloca DENTRO del contenedor de página (`px-5 md:px-6`): la pista sangra
 * hasta los bordes con márgenes negativos del mismo ancho, así las cards
 * asoman por el lateral en móvil y las sombras no se recortan.
 */
export function ProductCarousel({
  title,
  products,
  viewAllHref,
  className,
  eyebrow,
  eagerImages = false,
}: ProductCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  // Los modelos de un mismo grupo comparten card; agrupar aquí deja la firma
  // (lista plana de productos) igual para todos los consumidores.
  const entries = useMemo(() => groupCatalog(products), [products]);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    // ResizeObserver no existe en WebViews viejos; las flechas igual se
    // recalculan en cada scroll, así que degradar sin observer es aceptable.
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateArrows)
        : null;
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      observer?.disconnect();
    };
  }, [updateArrows, entries.length]);

  const scrollByDir = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    el.scrollBy({
      left: dir * Math.round(el.clientWidth * 0.85),
      behavior: reduced ? "auto" : "smooth",
    });
  };

  if (entries.length === 0) return null;

  return (
    <section className={className} aria-label={title}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2
            className={cn(
              "font-display text-[20px] leading-tight text-ink md:text-[24px]",
              eyebrow && "mt-1.5"
            )}
          >
            {title}
          </h2>
        </div>
        <div className="flex flex-none items-center gap-3 md:gap-4">
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="nav-label text-navy-700 transition-colors duration-150 hover:text-navy-600"
            >
              Ver todo
            </Link>
          )}
          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() => scrollByDir(-1)}
              disabled={!canLeft}
              aria-label={`Anterior en ${title}`}
              className={ARROW_CLASS}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => scrollByDir(1)}
              disabled={!canRight}
              aria-label={`Siguiente en ${title}`}
              className={ARROW_CLASS}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="no-scrollbar -mx-5 -mb-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pt-2 pb-7 md:-mx-6 md:gap-4 md:scroll-px-6 md:px-6"
      >
        {entries.map((entry, index) => (
          <div key={entry.key} className="flex flex-none snap-start">
            <ProductCard
              product={entry.primary}
              models={entry.models}
              variant="carousel"
              priority={eagerImages && index < 3}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
