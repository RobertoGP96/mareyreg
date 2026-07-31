"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { Heart } from "lucide-react";
import type { WebstoreProduct } from "@/lib/erp-client";
import { discountPct, fmt } from "@/lib/format";
import { useStore, type CartLine } from "@/lib/store";
import { ProductImage } from "@/components/product-image";
import { StockLabel } from "@/components/ui/stock-label";

export function baseCartLine(product: WebstoreProduct): CartLine {
  return {
    sku: product.sku,
    productSku: product.sku,
    name: product.name,
    presentationName: null,
    unitPrice: product.price,
    qty: 1,
    imageUrl: product.imageUrl,
    stockAvailable: product.stockAvailable,
  };
}

type CardVariant = "grid" | "carousel" | "favorite";

interface ProductCardProps {
  product: WebstoreProduct;
  variant?: CardVariant;
  /** true solo para cards above-the-fold: precarga la imagen (LCP). */
  priority?: boolean;
}

const PADDING: Record<CardVariant, string> = {
  grid: "px-6 pt-[26px] pb-7",
  carousel: "px-5 pt-5 pb-6",
  favorite: "px-6 pt-[26px] pb-7",
};

export function ProductCard({
  product,
  variant = "grid",
  priority = false,
}: ProductCardProps) {
  const { state, toggleFav, addToCart, showToast } = useStore();
  const currency = state.currency;
  const isFav = state.favs.includes(product.sku);
  const soldOut = product.stockAvailable <= 0;
  const pct = discountPct(product);

  const handleFav = (e: MouseEvent) => {
    e.preventDefault();
    toggleFav(product.sku);
  };

  const handleAdd = (e: MouseEvent) => {
    e.preventDefault();
    if (soldOut) {
      showToast("Producto agotado");
      return;
    }
    addToCart(baseCartLine(product), 1);
    showToast(`${product.name} añadido a la bolsa`);
  };

  return (
    <article
      className={`group relative flex h-full flex-col gap-[18px] border border-line-soft bg-canvas shadow-card transition-[box-shadow,transform,border-color] duration-200 hover:border-line hover:shadow-card-hover motion-safe:hover:-translate-y-0.5 ${
        PADDING[variant]
      } ${variant === "carousel" ? "w-[230px] flex-none snap-start" : ""}`}
    >
      {/* El enlace cubre la celda entera para que toda la card navegue, pero se
          queda debajo de los controles (favorito, añadir), que llevan z-10. */}
      <Link
        href={`/producto/${encodeURIComponent(product.sku)}`}
        className="absolute inset-0 z-0"
        aria-label={product.name}
      />

      <div className="relative aspect-square w-full overflow-hidden bg-surface text-[9px] tracking-[.22em] text-slate-300">
        <span className="absolute inset-0 flex items-center justify-center">
          <ProductImage
            src={product.imageUrl}
            alt=""
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 320px"
            priority={priority}
          />
        </span>
        {product.featured && !soldOut && (
          <span className="absolute top-0 left-0 bg-canvas px-[9px] py-[5px] text-[8.5px] font-semibold tracking-[.22em] text-navy-900 uppercase">
            Destacado
          </span>
        )}
        {soldOut && (
          <span className="absolute top-0 left-0 bg-alert px-[9px] py-[5px] text-[8.5px] font-bold tracking-[.22em] text-alert-fg uppercase">
            Agotado
          </span>
        )}
        {!soldOut && pct > 0 && (
          <span className="absolute top-0 right-0 bg-canvas px-[9px] py-[5px] text-[8.5px] font-semibold tracking-[.22em] text-danger uppercase">
            −{pct}%
          </span>
        )}
        <button
          type="button"
          onClick={handleFav}
          aria-label={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
          aria-pressed={isFav}
          className={`absolute right-0 bottom-0 z-10 flex h-9 w-9 items-center justify-center bg-canvas transition-colors duration-150 ${
            isFav ? "text-danger" : "text-slate-400 hover:text-navy-900"
          }`}
        >
          <Heart
            className="h-4 w-4"
            strokeWidth={1.6}
            fill={isFav ? "currentColor" : "none"}
          />
        </button>
      </div>

      <div className="flex flex-col gap-[7px]">
        {product.category && (
          <span className="eyebrow truncate">{product.category}</span>
        )}
        <h3 className="line-clamp-2 text-[16px] leading-[1.35] font-semibold text-ink">
          {product.name}
        </h3>
        <StockLabel stock={product.stockAvailable} />
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-line-soft pt-[14px]">
        <div className="min-w-0">
          <div className="tabular truncate text-[17px] font-bold text-navy-900">
            {fmt(product.price, currency)}
            {product.isCatchWeight && (
              <span className="text-[11px] font-medium text-slate-400">
                {" "}
                / kg
              </span>
            )}
          </div>
          {product.compareAtPrice != null && (
            <div className="tabular mt-0.5 text-[11px] font-medium text-slate-400 line-through">
              {fmt(product.compareAtPrice, currency)}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          aria-disabled={soldOut}
          className={`relative z-10 flex-none px-3.5 py-2.5 text-[11.5px] font-bold tracking-[.16em] uppercase transition-colors duration-150 ${
            soldOut
              ? "cursor-not-allowed bg-surface text-disabled"
              : "bg-surface text-navy-900 hover:bg-navy-900 hover:text-canvas"
          }`}
        >
          {soldOut ? "Agotado" : "Añadir"}
        </button>
      </div>
    </article>
  );
}
