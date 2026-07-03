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
  /** true solo para el primer carrusel de la página: precarga las primeras imágenes (LCP). */
  eagerImages?: boolean;
}

/**
 * Carrusel horizontal de productos con scroll-snap. En móvil se desliza con
 * el dedo; en desktop agrega flechas que se deshabilitan en los extremos.
 */
export function ProductCarousel({
  title,
  products,
  viewAllHref,
  className = "",
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
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      observer.disconnect();
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

  const arrowClass =
    "flex h-8 w-8 items-center justify-center rounded-[10px] border border-line bg-white text-ink-soft transition-colors hover:border-brand-soft hover:text-brand disabled:cursor-default disabled:opacity-35 disabled:hover:border-line disabled:hover:text-ink-soft";

  return (
    <section className={className} aria-label={title}>
      <div className="flex items-center justify-between px-5 pb-2 md:px-10">
        <h2 className="text-base font-semibold text-navy md:text-lg">
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-[13px] font-medium text-brand-mid transition-colors hover:text-brand"
            >
              Ver todo →
            </Link>
          )}
          <div className="hidden gap-1.5 md:flex">
            <button
              type="button"
              onClick={() => scrollByDir(-1)}
              disabled={!canLeft}
              aria-label={`Anterior en ${title}`}
              className={arrowClass}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollByDir(1)}
              disabled={!canRight}
              aria-label={`Siguiente en ${title}`}
              className={arrowClass}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-px-5 px-5 pt-1.5 pb-5 md:gap-5 md:scroll-px-10 md:px-10"
      >
        {products.map((product, index) => (
          <ProductCard
            key={product.sku}
            product={product}
            variant="carousel"
            priority={eagerImages && index < 3}
          />
        ))}
      </div>
    </section>
  );
}
