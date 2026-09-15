"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type MouseEvent } from "react";
import { Heart, Plus } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { FormatSelector } from "@/components/format-selector";
import { ModelSelector } from "@/components/model-selector";
import { ProductDetailDrawer } from "@/components/product-detail-drawer";
import { ProductImage } from "@/components/product-image";
import { Badge } from "@/components/ui/badge";
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

/** Ancho de la card en carrusel: los esqueletos de carga lo replican. */
export const CAROUSEL_CARD_WIDTH = "w-[210px]";

const PADDING: Record<CardVariant, string> = {
  grid: "p-3 pb-4 sm:p-4 sm:pb-5",
  carousel: "p-3.5 pb-[18px]",
  favorite: "p-3 pb-4 sm:p-4 sm:pb-5",
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

  const addLabel = soldOut ? "Agotado" : needsPieceChoice ? "Elegir pieza" : "Añadir";
  const addSrLabel = soldOut
    ? "Agotado"
    : needsPieceChoice
      ? "Elegir pieza"
      : "Añadir a la bolsa";

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col gap-3.5 rounded-lg bg-canvas shadow-card transition-[box-shadow,transform] duration-200 hover:shadow-float motion-safe:hover:-translate-y-0.5",
        PADDING[variant],
        variant === "carousel" && `${CAROUSEL_CARD_WIDTH} flex-none snap-start`
      )}
    >
      {/* El enlace cubre la celda entera para que toda la card navegue. Va por
          encima de la foto y el texto (z-[1]: el contenedor de la foto es
          `relative` y con z-0 lo tapaba, dejando el clic sin efecto) pero
          debajo de los controles (favorito, selectores, añadir), que llevan
          z-10. */}
      <Link
        href={`/producto/${encodeURIComponent(selected.sku)}`}
        onClick={handleOpenDetail}
        className="absolute inset-0 z-[1] rounded-lg"
        aria-label={displayName(selected)}
      />

      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-surface">
        <span className="absolute inset-0 flex items-center justify-center">
          {/* key: ProductImage guarda `failed`; al cambiar de modelo debe reintentar la foto nueva. */}
          <ProductImage
            key={selected.sku}
            src={selected.imageUrl}
            alt=""
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
            priority={priority}
          />
        </span>
        {selected.featured && !soldOut && (
          <Badge variant="featured" className="absolute top-2 left-2">
            Destacado
          </Badge>
        )}
        {soldOut && (
          <Badge variant="soldout" className="absolute top-2 left-2">
            Agotado
          </Badge>
        )}
        {!soldOut && pct > 0 && (
          <Badge variant="discount" className="absolute top-2 right-2">
            −{pct}%
          </Badge>
        )}
        <button
          type="button"
          onClick={handleFav}
          aria-label={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
          aria-pressed={isFav}
          className={cn(
            "absolute right-2 bottom-2 z-10 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-canvas shadow-card transition-[color,transform] duration-150 motion-safe:active:scale-90",
            isFav ? "text-danger" : "text-slate-400 hover:text-navy-700"
          )}
        >
          <Heart
            className="h-4 w-4"
            strokeWidth={1.9}
            fill={isFav ? "currentColor" : "none"}
          />
        </button>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        {selected.category && (
          <span className="eyebrow truncate">{selected.category}</span>
        )}
        <h3 className="line-clamp-2 text-[14.5px] leading-[1.35] font-semibold text-ink sm:text-[15px]">
          {title}
        </h3>
        {hasSelectors && (
          <div className="relative z-10 mt-0.5 flex min-w-0 flex-col gap-2.5">
            <ModelSelector
              models={models}
              selectedSku={selected.sku}
              onSelect={selectModel}
              optionLabel={selected.modelGroup?.optionLabel ?? "Modelo"}
              size="sm"
            />
            <FormatSelector
              product={selected}
              selectedSku={format.sku}
              onSelect={setFormatSku}
              currency={currency}
              size="sm"
            />
          </div>
        )}
        <StockLabel stock={selected.stockAvailable} />
      </div>

      <div className="mt-auto flex items-end justify-between gap-2.5 border-t border-line pt-3">
        <div className="min-w-0" aria-live="polite">
          <div className="tabular text-[15px] leading-tight font-bold text-navy-900 sm:text-[16px]">
            <span className="whitespace-nowrap">{fmt(price, currency)}</span>
            {/* En la card compacta el sufijo baja de línea para no truncar el
                monto; en desktop vuelve junto al precio. */}
            {selected.isCatchWeight && format.isBase && (
              <span className="block text-[11px] font-medium text-slate-400 sm:ml-1 sm:inline">
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
        {/* En móvil, con dos columnas, no cabe el rótulo junto al precio: el
            botón se reduce a un círculo con "+" y el texto queda para lectores. */}
        <button
          type="button"
          onClick={handleAdd}
          aria-disabled={soldOut}
          className={cn(
            "relative z-10 flex h-9 w-9 flex-none items-center justify-center rounded-full font-semibold transition-[background-color,transform] duration-150 motion-safe:active:scale-95 sm:h-auto sm:w-auto sm:px-4 sm:py-[9px] sm:text-[12.5px]",
            soldOut
              ? "cursor-not-allowed bg-surface text-disabled"
              : "bg-navy-700 text-on-brand hover:bg-navy-600"
          )}
        >
          <Plus className="h-4 w-4 sm:hidden" strokeWidth={2.4} aria-hidden />
          <span className="hidden sm:inline">{addLabel}</span>
          <span className="sr-only sm:hidden">{addSrLabel}</span>
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
