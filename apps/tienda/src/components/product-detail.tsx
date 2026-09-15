"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { Heart, Truck } from "lucide-react";
import type {
  WebstoreCurrency,
  WebstoreProduct,
  WebstoreProductPresentation,
} from "@/lib/erp-client";
import { fmt } from "@/lib/format";
import { FREE_SHIPPING_TARGET } from "@/lib/cart-totals";
import {
  basePresentation,
  cartLineFor,
  displayName,
  formatAvailable,
  formatCompareAtPrice,
  formatDiscountPct,
  formatPrice,
  matchingPieces as matchingPiecesFor,
  sortedPresentations,
} from "@/lib/model-groups";
import { useStore, type CartLine } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ModelSelector } from "@/components/model-selector";
import { ProductImage } from "@/components/product-image";
import { QtyStepper } from "@/components/qty-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CHIP_BASE,
  CHIP_OFF,
  CHIP_ON,
  ChoiceChips,
} from "@/components/ui/choice-chips";
import { StockLabel } from "@/components/ui/stock-label";

interface ProductDetailProps {
  product: WebstoreProduct;
  currency: WebstoreCurrency;
  /** Modelos del grupo (incluido `product`). Cambiar de modelo cambia el
   *  `product` entero; formato, cantidad y piezas se reinician aquí dentro
   *  (sin remontar: el chip enfocado debe conservar el foco del teclado). */
  models?: WebstoreProduct[];
  onSelectModel?: (sku: string) => void;
  /** `page` reparte imagen e info en dos columnas; `drawer` apila en una sola
   *  con el CTA pegado al borde inferior de la hoja. */
  variant?: "page" | "drawer";
  /** Se llama justo antes de navegar al carrito, para que la hoja se cierre. */
  onAdded?: () => void;
}

const BLOCK = "mt-6 border-t border-line-soft pt-6";

export function ProductDetail({
  product,
  currency,
  models,
  onSelectModel,
  variant = "page",
  onAdded,
}: ProductDetailProps) {
  const router = useRouter();
  const { state, toggleFav, addToCart, showToast } = useStore();
  const isDrawer = variant === "drawer";
  const presentationLabelId = useId();

  const presentations = useMemo(() => sortedPresentations(product), [product]);
  const hasSelector = presentations.length > 1;
  const hasModels = (models?.length ?? 0) > 1;

  const [selected, setSelected] =
    useState<WebstoreProductPresentation | null>(presentations[0] ?? null);
  const [qty, setQty] = useState(1);
  const [selectedPieceIds, setSelectedPieceIds] = useState<number[]>([]);

  // Otro modelo = otro producto: formato, cantidad y piezas vuelven al inicio.
  const [seenProduct, setSeenProduct] = useState(product);
  if (seenProduct !== product) {
    setSeenProduct(product);
    setSelected(presentations[0] ?? null);
    setQty(1);
    setSelectedPieceIds([]);
  }

  const isFav = state.favs.includes(product.sku);
  const soldOut = product.stockAvailable <= 0;
  const formatSoldOut = selected != null && !formatAvailable(product, selected);
  const pct = formatDiscountPct(product, selected ?? basePresentation(product));

  const isBaseSelected = selected == null || selected.isBase;
  // Precio efectivo del formato (descuento y moneda ya aplicados por el ERP);
  // en catch-weight el cobro real es por kg y la referencia es el ESTIMADO.
  const unitPrice = selected ? formatPrice(product, selected) : product.price;
  const unitLabel = isBaseSelected ? "unidad" : selected.name.toLowerCase();
  // Precio principal mostrado: por kg en productos de peso variable.
  const showPerKg = product.isCatchWeight && product.pricePerKg != null;
  const headlinePrice = showPerKg ? product.pricePerKg! : unitPrice;
  const headlineUnit = showPerKg ? "kg" : unitLabel;
  // El tachado acompaña al precio principal: por kg cuando el titular es por
  // kg (no cambia con el formato), si no el del formato elegido.
  const compareAt = showPerKg
    ? product.compareAtPrice != null && product.compareAtPrice > headlinePrice
      ? product.compareAtPrice
      : null
    : selected
      ? formatCompareAtPrice(product, selected)
      : product.compareAtPrice;

  // Pesajes disponibles que corresponden a la presentación elegida. Si hay
  // piezas, el cliente elige la exacta y paga su peso real.
  const matchingPieces = useMemo(
    () => (selected ? matchingPiecesFor(product, selected) : []),
    [product, selected]
  );
  const usePieceSelection = matchingPieces.length > 0;
  const selectedPieces = matchingPieces.filter((p) =>
    selectedPieceIds.includes(p.pieceId)
  );
  const piecesTotal = selectedPieces.reduce((s, p) => s + (p.price ?? 0), 0);

  const togglePiece = (pieceId: number) => {
    setSelectedPieceIds((prev) =>
      prev.includes(pieceId)
        ? prev.filter((id) => id !== pieceId)
        : [...prev, pieceId]
    );
  };

  const displayTotal = usePieceSelection ? piecesTotal : unitPrice * qty;
  const addDisabled =
    soldOut ||
    formatSoldOut ||
    (usePieceSelection && selectedPieces.length === 0);

  const offerEndsAtLabel =
    product.offer?.endsAt != null
      ? new Date(product.offer.endsAt).toLocaleDateString("es-MX", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  const handleAdd = () => {
    if (soldOut || formatSoldOut) {
      showToast("Producto agotado");
      return;
    }
    if (usePieceSelection && selectedPieces.length === 0) {
      showToast("Elige al menos una pieza");
      return;
    }
    const line: CartLine = {
      ...cartLineFor(product, selected ?? basePresentation(product)),
      ...(usePieceSelection
        ? {
            pieces: selectedPieces.map((p) => ({
              pieceId: p.pieceId,
              weightKg: p.weightKg,
              price: p.price ?? 0,
            })),
          }
        : {}),
    };
    addToCart(line, usePieceSelection ? selectedPieces.length : qty);
    showToast(`${displayName(product)} añadido al carrito`);
    onAdded?.();
    router.push("/carrito");
  };

  const piecesLabel = `${selectedPieces.length} pza${
    selectedPieces.length === 1 ? "" : "s"
  }`;

  const media = (
    <div
      className={cn(
        "relative overflow-hidden bg-surface",
        isDrawer
          ? "mx-5 mt-1 aspect-[4/3] rounded-md"
          : "aspect-square rounded-lg shadow-card md:sticky md:top-[84px]"
      )}
    >
      <span className="absolute inset-0 flex items-center justify-center">
        <ProductImage
          key={product.sku}
          src={product.imageUrl}
          alt={displayName(product)}
          sizes={isDrawer ? "100vw" : "(min-width: 768px) 50vw, 100vw"}
          label="Foto producto"
          priority={!isDrawer}
        />
      </span>
      {product.featured && !soldOut && (
        <Badge variant="featured" className="absolute top-3 left-3">
          Destacado
        </Badge>
      )}
      {soldOut && (
        <Badge variant="soldout" className="absolute top-3 left-3">
          Agotado
        </Badge>
      )}
      {!soldOut && pct > 0 && (
        <Badge variant="discount" className="absolute top-3 right-3">
          −{pct}%
        </Badge>
      )}
      <button
        type="button"
        onClick={() => toggleFav(product.sku)}
        aria-label={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
        aria-pressed={isFav}
        className={cn(
          "absolute right-3 bottom-3 flex h-11 w-11 items-center justify-center rounded-full bg-canvas shadow-card transition-[color,transform] duration-150 motion-safe:active:scale-90",
          isFav ? "text-danger" : "text-slate-400 hover:text-navy-700"
        )}
      >
        <Heart
          className="h-5 w-5"
          strokeWidth={1.8}
          fill={isFav ? "currentColor" : "none"}
        />
      </button>
    </div>
  );

  const Heading = isDrawer ? "h2" : "h1";

  const info = (
    <>
      {product.category && <p className="eyebrow">{product.category}</p>}
      <Heading
        className={cn(
          "font-display mt-3 leading-[1.15] text-balance text-navy-900",
          isDrawer ? "text-[22px]" : "text-[26px] md:text-[32px]"
        )}
      >
        {displayName(product, false)}
      </Heading>
      {product.modelGroup && (
        <p className="eyebrow mt-2.5">
          {product.modelGroup.optionLabel} · {product.modelGroup.modelLabel}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="tabular text-[26px] font-bold text-navy-900">
          {fmt(headlinePrice, currency)}
        </span>
        {compareAt != null && (
          <span className="tabular text-[14px] text-slate-400 line-through">
            {fmt(compareAt, currency)}
          </span>
        )}
        <span className="text-[12.5px] font-medium text-slate-400">
          / {headlineUnit}
        </span>
      </div>
      {product.isCatchWeight && !usePieceSelection && (
        <p className="mt-2.5 text-[12.5px] leading-[1.6] text-slate-400">
          Precio estimado · el total se ajusta al peso real al preparar tu
          pedido
        </p>
      )}
      {usePieceSelection && (
        <p className="mt-2.5 text-[12.5px] leading-[1.6] text-slate-400">
          Elige tu pieza exacta · pagas por su peso real
        </p>
      )}

      <StockLabel stock={product.stockAvailable} className="mt-4" />

      {product.offer && (
        <div className={BLOCK}>
          <p className="eyebrow">Oferta</p>
          <p className="mt-3 text-[14px] font-semibold text-ink">
            {product.offer.name}
          </p>
          {offerEndsAtLabel && (
            <p className="mt-1.5 text-[12.5px] text-slate-400">
              Termina el {offerEndsAtLabel}
            </p>
          )}
        </div>
      )}

      {product.description && (
        <div className={BLOCK}>
          <p className="text-[13.5px] leading-[1.65] text-pretty text-slate-500">
            {product.description}
          </p>
        </div>
      )}

      {hasModels && models && (
        <div className={BLOCK}>
          <ModelSelector
            models={models}
            selectedSku={product.sku}
            onSelect={(sku) => onSelectModel?.(sku)}
            optionLabel={product.modelGroup?.optionLabel ?? "Modelo"}
          />
        </div>
      )}

      {hasSelector && (
        <div className={BLOCK}>
          <p id={presentationLabelId} className="eyebrow">
            Presentación
          </p>
          <ChoiceChips
            labelledBy={presentationLabelId}
            value={selected?.sku ?? null}
            onChange={(sku) => {
              const pres = presentations.find((p) => p.sku === sku);
              if (!pres) return;
              setSelected(pres);
              setSelectedPieceIds([]);
            }}
            className="mt-3"
            options={presentations.map((pres) => ({
              value: pres.sku,
              label: `${pres.name} · ${product.isCatchWeight ? "≈" : ""}${fmt(
                formatPrice(product, pres),
                currency
              )}`,
              disabled: !formatAvailable(product, pres),
            }))}
          />
          {selected?.wholesalePrice != null && (
            <p className="tabular mt-3 text-[12.5px] text-slate-400">
              Mayoreo: {fmt(selected.wholesalePrice, currency)}
            </p>
          )}
        </div>
      )}

      {usePieceSelection && (
        <div className={BLOCK}>
          <p className="eyebrow">Piezas disponibles</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {matchingPieces.map((p) => {
              const active = selectedPieceIds.includes(p.pieceId);
              return (
                <button
                  key={p.pieceId}
                  type="button"
                  onClick={() => togglePiece(p.pieceId)}
                  aria-pressed={active}
                  className={cn(CHIP_BASE, active ? CHIP_ON : CHIP_OFF)}
                >
                  {p.weightKg.toFixed(2)} kg · {fmt(p.price ?? 0, currency)}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[12.5px] leading-[1.6] text-slate-400">
            Selecciona una o varias piezas; cada una se cobra por su peso real.
          </p>
        </div>
      )}

      {!usePieceSelection && (
        <div className={BLOCK}>
          <div className="flex items-center justify-between gap-5">
            <span className="eyebrow">Cantidad</span>
            <QtyStepper
              size="lg"
              qty={qty}
              onInc={() => setQty((q) => q + 1)}
              onDec={() => setQty((q) => Math.max(1, q - 1))}
            />
          </div>
        </div>
      )}
    </>
  );

  const cta = (
    <>
      <div className="flex items-baseline justify-between gap-5">
        <span className="text-[12.5px] text-slate-400">
          Total{" "}
          <span className="tabular">
            {usePieceSelection
              ? `(${piecesLabel})`
              : `(${qty} × ${fmt(unitPrice, currency)})`}
          </span>
        </span>
        <span className="tabular text-[20px] font-bold text-navy-900">
          {fmt(displayTotal, currency)}
        </span>
      </div>
      {product.isCatchWeight && !usePieceSelection && (
        <p className="mt-2.5 text-[12.5px] leading-[1.6] text-slate-400">
          El total se ajusta al peso real al preparar tu pedido
        </p>
      )}
      {usePieceSelection && (
        <p className="mt-2.5 text-[12.5px] leading-[1.6] text-slate-400">
          Precio real por pieza — sin ajustes al preparar tu pedido
        </p>
      )}

      <Button
        variant="solid"
        size="lg"
        onClick={handleAdd}
        aria-disabled={addDisabled}
        className={cn(
          "mt-5 w-full",
          addDisabled &&
            "cursor-not-allowed bg-surface text-disabled hover:bg-surface"
        )}
      >
        {soldOut || formatSoldOut
          ? "Agotado"
          : usePieceSelection
            ? "Añadir piezas"
            : "Añadir a la bolsa"}
      </Button>

      <p className="tabular mt-4 flex items-center gap-2 text-[12.5px] text-slate-400">
        <Truck className="h-4 w-4 flex-none" strokeWidth={1.8} />
        Envío gratis en pedidos desde {fmt(FREE_SHIPPING_TARGET, currency)}
      </p>
    </>
  );

  if (isDrawer) {
    return (
      <div className="flex flex-col">
        {media}
        <div className="flex flex-col px-5 pt-6">{info}</div>
        {/* Pegado al borde de la hoja: en una lista larga de presentaciones o
            pesajes el CTA quedaría fuera de alcance al final del scroll. */}
        <div className="sticky bottom-0 mt-6 border-t border-line bg-canvas/95 px-5 pt-4 pb-5 backdrop-blur">
          {cta}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-6 md:px-6 md:py-10">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10 lg:gap-14">
        {/* La celda se estira a la altura de la fila; la imagen (cuadrada)
            queda pegada dentro de ella mientras la columna de info hace scroll. */}
        <div>{media}</div>
        <div className="flex flex-col rounded-lg bg-canvas p-5 shadow-card md:p-7">
          {info}
          <div className={BLOCK}>{cta}</div>
        </div>
      </div>
    </div>
  );
}
