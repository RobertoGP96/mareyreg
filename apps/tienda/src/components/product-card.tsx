"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { Heart, Plus } from "lucide-react";
import type { WebstoreProduct } from "@/lib/erp-client";
import { discountPct, fmt, stockInfo } from "@/lib/format";
import { useStore, type CartLine } from "@/lib/store";
import { ProductImage } from "@/components/product-image";

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
}

const IMAGE_HEIGHT: Record<CardVariant, string> = {
  grid: "h-[110px] md:h-[170px]",
  carousel: "h-[118px] md:h-[150px]",
  favorite: "h-[104px] md:h-[150px]",
};

export function ProductCard({ product, variant = "grid" }: ProductCardProps) {
  const { state, toggleFav, addToCart, showToast } = useStore();
  const isFav = state.favs.includes(product.sku);
  const soldOut = product.stockAvailable <= 0;
  const stock = stockInfo(product.stockAvailable);
  const pct = discountPct(product);

  const handleFav = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFav(product.sku);
  };

  const handleAdd = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (soldOut) {
      showToast("Producto agotado");
      return;
    }
    addToCart(baseCartLine(product), 1);
    showToast(`${product.name} añadido al carrito`);
  };

  return (
    <Link
      href={`/producto/${encodeURIComponent(product.sku)}`}
      className={`group block overflow-hidden rounded-2xl bg-white shadow-[0_3px_12px_rgba(10,31,63,.06)] transition-[transform,box-shadow] duration-200 hover:shadow-[0_10px_28px_rgba(10,31,63,.14)] motion-safe:hover:-translate-y-1 ${
        variant === "carousel"
          ? "w-[164px] flex-none shadow-[0_3px_12px_rgba(10,31,63,.07)] md:w-auto"
          : ""
      }`}
    >
      <div
        className={`relative flex items-center justify-center overflow-hidden bg-photo text-[11px] tracking-[.5px] text-photo-fg ${IMAGE_HEIGHT[variant]}`}
      >
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          sizes="(max-width: 430px) 50vw, (max-width: 768px) 33vw, 280px"
        />
        {variant === "grid" && soldOut && (
          <span className="absolute top-2 left-2 rounded-md bg-[#6B7A94] px-2 py-[3px] text-[10px] font-semibold text-white">
            AGOTADO
          </span>
        )}
        {variant === "grid" && !soldOut && pct > 0 && (
          <span className="absolute top-2 left-2 rounded-md bg-brand px-2 py-[3px] text-[10px] font-semibold text-white">
            −{pct}%
          </span>
        )}
        <button
          type="button"
          onClick={handleFav}
          aria-label={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
          className={`absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-[9px] bg-white shadow-[0_2px_6px_rgba(10,31,63,.12)] transition-[color,transform] hover:scale-110 active:scale-95 ${
            isFav ? "text-fav" : "text-muted-2 hover:text-fav"
          }`}
        >
          <Heart
            className="h-[15px] w-[15px]"
            fill={isFav ? "currentColor" : "none"}
          />
        </button>
      </div>
      <div className={variant === "carousel" ? "px-3 pt-[11px] pb-[13px]" : "px-3 pt-2.5 pb-3"}>
        <div className="mt-[3px] min-h-[34px] text-[13px] leading-[1.3] font-medium text-ink">
          {product.name}
        </div>
        {variant === "grid" && (
          <div
            className="mt-1 text-[11px] font-medium"
            style={{ color: stock.color }}
          >
            {stock.label}
          </div>
        )}
        <div className="mt-[7px] flex items-center justify-between">
          <div>
            <div className="text-[15px] font-bold text-navy">
              {fmt(product.price)}
            </div>
            {variant === "grid" && product.compareAtPrice != null && (
              <div className="text-[11px] text-muted-2 line-through">
                {fmt(product.compareAtPrice)}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            aria-label="Añadir al carrito"
            className={`flex h-7 w-7 items-center justify-center rounded-[9px] text-white transition-[background-color,transform] active:scale-95 ${
              soldOut ? "bg-disabled" : "bg-brand hover:bg-brand-mid"
            }`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Link>
  );
}
