"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type MouseEvent } from "react";
import { Heart } from "lucide-react";
import type { WebstoreProduct } from "@/lib/erp-client";
import { fmt } from "@/lib/format";
import {
  cartLineFor,
  displayName,
  formatAvailable,
  formatCompareAtPrice,
  formatDiscountPct,
  formatPrice,
  formatRequiresPieceChoice,
  sortedPresentations,
} from "@/lib/model-groups";
import { useStore } from "@/lib/store";
import { FormatSelector } from "@/components/format-selector";
import { ModelSelector } from "@/components/model-selector";
import { ProductDetailDrawer } from "@/components/product-detail-drawer";
import { ProductImage } from "@/components/product-image";
import { StockLabel } from "@/components/ui/stock-label";

type CardVariant = "grid" | "carousel" | "favorite";

interface ProductCardProps {
  product: WebstoreProduct;
  /** Modelos del grupo (incluido `product`). Omitido o de 1 = card sin selector de modelo. */
  models?: WebstoreProduct[];
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
  models: modelsProp,
  variant = "grid",
  priority = false,
}: ProductCardProps) {
  const { state, toggleFav, addToCart, showToast } = useStore();
  const router = useRouter();
  const currency = state.currency;

  const models = useMemo(
    () => (modelsProp && modelsProp.length > 0 ? modelsProp : [product]),
    [modelsProp, product]
  );
  const [selectedSku, setSelectedSku] = useState(product.sku);
  const selected = models.find((m) => m.sku === selectedSku) ?? product;

  const formats = useMemo(() => sortedPresentations(selected), [selected]);
  // null = base del modelo vigente; al cambiar de modelo vuelve a la base.
  const [formatSku, setFormatSku] = useState<string | null>(null);
  const format = formats.find((f) => f.sku === formatSku) ?? formats[0];

  const selectModel = (sku: string) => {
    setSelectedSku(sku);
    setFormatSku(null);
  };

  const isFav = state.favs.includes(selected.sku);
  const soldOut = !formatAvailable(selected, format);
  // Con pesajes registrados el cliente elige la pieza exacta en el detalle;
  // la card no debe meter una línea estimada que pisaría esa elección.
  const needsPieceChoice = !soldOut && formatRequiresPieceChoice(selected, format);
  const pct = formatDiscountPct(selected, format);
  const price = formatPrice(selected, format);
  const compareAt = formatCompareAtPrice(selected, format);
  const title = displayName(selected, models.length <= 1);
  const hasSelectors = models.length > 1 || formats.length > 1;
  const [detailOpen, setDetailOpen] = useState(false);

  // En móvil el detalle se abre como hoja inferior en lugar de navegar. El
  // enlace real se conserva —SEO, compartir, abrir en pestaña nueva— y solo se
  // intercepta el clic primario sin modificadores, que es el gesto táctil.
  const isMobileViewport = () =>
    window.matchMedia("(max-width: 767px)").matches;

  const handleOpenDetail = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!isMobileViewport()) return;
    e.preventDefault();
    setDetailOpen(true);
  };

  const handleFav = (e: MouseEvent) => {
    e.preventDefault();
    toggleFav(selected.sku);
  };

  const handleAdd = (e: MouseEvent) => {
    e.preventDefault();
    if (soldOut) {
      showToast("Producto agotado");
      return;
    }
    if (needsPieceChoice) {
      if (isMobileViewport()) setDetailOpen(true);
      else router.push(`/producto/${encodeURIComponent(selected.sku)}`);
      return;
    }
    addToCart(cartLineFor(selected, format), 1);
    const label = format.isBase
      ? displayName(selected)
      : `${displayName(selected)} · ${format.name}`;
    showToast(`${label} añadido a la bolsa`);
  };

  return (
    <article
      className={`group relative flex h-full flex-col gap-[18px] border border-line-soft bg-canvas shadow-card transition-[box-shadow,transform,border-color] duration-200 hover:border-line hover:shadow-card-hover motion-safe:hover:-translate-y-0.5 ${
        PADDING[variant]
      } ${variant === "carousel" ? "w-[230px] flex-none snap-start" : ""}`}
    >
      {/* El enlace cubre la celda entera para que toda la card navegue, pero se
          queda debajo de los controles (favorito, selectores, añadir), que
          llevan z-10. */}
      <Link
        href={`/producto/${encodeURIComponent(selected.sku)}`}
        onClick={handleOpenDetail}
        className="absolute inset-0 z-0"
        aria-label={displayName(selected)}
      />

      <div className="relative aspect-square w-full overflow-hidden bg-surface text-[9px] tracking-[.22em] text-slate-300">
        <span className="absolute inset-0 flex items-center justify-center">
          {/* key: ProductImage guarda `failed`; al cambiar de modelo debe reintentar la foto nueva. */}
          <ProductImage
            key={selected.sku}
            src={selected.imageUrl}
            alt=""
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 320px"
            priority={priority}
          />
        </span>
        {selected.featured && !soldOut && (
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

      <div className="flex min-w-0 flex-col gap-[7px]">
        {selected.category && (
          <span className="eyebrow truncate">{selected.category}</span>
        )}
        <h3 className="line-clamp-2 text-[16px] leading-[1.35] font-semibold text-ink">
          {title}
        </h3>
        {hasSelectors && (
          <div className="relative z-10 mt-1 flex min-w-0 flex-col gap-3">
            <ModelSelector
              models={models}
              selectedSku={selected.sku}
              onSelect={selectModel}
              optionLabel={selected.modelGroup?.optionLabel ?? "Modelo"}
            />
            <FormatSelector
              product={selected}
              selectedSku={format.sku}
              onSelect={setFormatSku}
              currency={currency}
            />
          </div>
        )}
        <StockLabel stock={selected.stockAvailable} />
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-line-soft pt-[14px]">
        <div className="min-w-0" aria-live="polite">
          <div className="tabular truncate text-[17px] font-bold text-navy-900">
            {fmt(price, currency)}
            {selected.isCatchWeight && format.isBase && (
              <span className="text-[11px] font-medium text-slate-400">
                {" "}
                / kg
              </span>
            )}
          </div>
          {compareAt != null && (
            <div className="tabular mt-0.5 text-[11px] font-medium text-slate-400 line-through">
              {fmt(compareAt, currency)}
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
          {soldOut ? "Agotado" : needsPieceChoice ? "Elegir pieza" : "Añadir"}
        </button>
      </div>

      <ProductDetailDrawer
        product={selected}
        models={models}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </article>
  );
}
