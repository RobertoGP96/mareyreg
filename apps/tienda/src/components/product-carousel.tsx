"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { WebstoreProduct } from "@/lib/erp-client";
import { ProductCard } from "@/components/product-card";

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
  "flex items-center justify-center text-slate-400 transition-colors duration-150 hover:text-navy-900 disabled:cursor-default disabled:text-disabled disabled:hover:text-disabled";

/**
 * Carrusel horizontal de productos con scroll-snap. En móvil se desliza con
 * el dedo; en desktop agrega flechas que se deshabilitan en los extremos.
 */
export function ProductCarousel({
  title,
  products,
  viewAllHref,
  className = "",
  eyebrow,
  eagerImages = false,
}: ProductCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

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
  }, [updateArrows, products.length]);

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

  if (products.length === 0) return null;

  return (
    <section className={className} aria-label={title}>
      <div className="flex items-end justify-between gap-5 px-5 md:px-10">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="font-display mt-4 text-[26px] leading-none text-navy-900 md:text-[32px]">
            {title}
          </h2>
        </div>
        <div className="flex flex-none items-center gap-5 md:gap-7">
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="nav-label text-slate-400 transition-colors duration-150 hover:text-navy-900"
            >
              Ver todo
            </Link>
          )}
          <div className="hidden items-center gap-4 md:flex">
            <button
              type="button"
              onClick={() => scrollByDir(-1)}
              disabled={!canLeft}
              aria-label={`Anterior en ${title}`}
              className={ARROW_CLASS}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.6} />
            </button>
            <button
              type="button"
              onClick={() => scrollByDir(1)}
              disabled={!canRight}
              aria-label={`Siguiente en ${title}`}
              className={ARROW_CLASS}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.6} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-5 px-5 py-2 md:scroll-px-10 md:px-10"
      >
        {products.map((product, index) => (
          <div key={product.sku} className="flex flex-none snap-start">
            <ProductCard
              product={product}
              variant="carousel"
              priority={eagerImages && index < 3}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
