"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Heart, Truck } from "lucide-react";
import type {
  WebstoreCurrency,
  WebstoreProduct,
  WebstoreProductPresentation,
} from "@/lib/erp-client";
import { discountPct, fmt } from "@/lib/format";
import { FREE_SHIPPING_TARGET } from "@/lib/cart-totals";
import { useStore, type CartLine } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/product-image";
import { QtyStepper } from "@/components/qty-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StockLabel } from "@/components/ui/stock-label";

interface ProductDetailProps {
  product: WebstoreProduct;
  currency: WebstoreCurrency;
  /** `page` reparte imagen e info en dos columnas; `drawer` apila en una sola
   *  con el CTA pegado al borde inferior de la hoja. */
  variant?: "page" | "drawer";
  /** Se llama justo antes de navegar al carrito, para que la hoja se cierre. */
  onAdded?: () => void;
}

const BLOCK = "mt-6 border-t border-line-soft pt-6";

const CHIP_BASE =
  "tabular flex-none rounded-full border-[1.5px] px-4 py-2 text-[13px] font-semibold transition-colors duration-150";
const CHIP_ON = "border-navy-700 bg-navy-700 text-on-brand";
const CHIP_OFF =
  "border-line bg-canvas text-slate-500 hover:border-navy-700 hover:text-navy-700";

export function ProductDetail({
  product,
  currency,
  variant = "page",
  onAdded,
}: ProductDetailProps) {
  const router = useRouter();
  const { state, toggleFav, addToCart, showToast } = useStore();
  const isDrawer = variant === "drawer";

  const presentations = useMemo(
    () =>
      [...product.presentations].sort(
        (a, b) => Number(b.isBase) - Number(a.isBase)
      ),
    [product.presentations]
  );
  const hasSelector = presentations.length > 1;

  const [selected, setSelected] =
    useState<WebstoreProductPresentation | null>(presentations[0] ?? null);
  const [qty, setQty] = useState(1);
  const [selectedPieceIds, setSelectedPieceIds] = useState<number[]>([]);

  const isFav = state.favs.includes(product.sku);
  const soldOut = product.stockAvailable <= 0;
  const pct = discountPct(product);

  const isBaseSelected = selected == null || selected.isBase;
  // Catch-weight: el cobro real siempre es por kg, así que el precio de la
  // presentación que se usa como referencia es el ESTIMADO (precio/kg × peso
  // nominal), nunca el retailPrice de la presentación.
  const unitPrice = selected
    ? product.isCatchWeight && selected.estimatedPrice != null
      ? selected.estimatedPrice
      : selected.retailPrice
    : product.price;
  const unitLabel = isBaseSelected ? "unidad" : selected.name.toLowerCase();
  // Precio principal mostrado: por kg en productos de peso variable.
  const showPerKg = product.isCatchWeight && product.pricePerKg != null;
  const headlinePrice = showPerKg ? product.pricePerKg! : unitPrice;
  const headlineUnit = showPerKg ? "kg" : unitLabel;
  const showCompare = isBaseSelected && product.compareAtPrice != null;

  // Pesajes disponibles que corresponden a la presentación elegida
  // (pieceCount casa con piecesPerUnit) y con precio ya calculado por el ERP.
  // Si hay piezas, el cliente elige la exacta y paga su peso real.
  const matchingPieces = useMemo(() => {
    if (!product.isCatchWeight || !product.pieces?.length) return [];
    const piecesPerUnit = selected?.piecesPerUnit ?? null;
    if (piecesPerUnit == null) return [];
    return product.pieces.filter(
      (p) => p.pieceCount === piecesPerUnit && p.price != null
    );
  }, [product, selected]);
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
  const addDisabled = soldOut || (usePieceSelection && selectedPieces.length === 0);

  const offerEndsAtLabel =
    product.offer?.endsAt != null
      ? new Date(product.offer.endsAt).toLocaleDateString("es-MX", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  const handleAdd = () => {
    if (soldOut) {
      showToast("Producto agotado");
      return;
    }
    if (usePieceSelection && selectedPieces.length === 0) {
      showToast("Elige al menos una pieza");
      return;
    }
    const line: CartLine = {
      sku: selected?.sku ?? product.sku,
      productSku: product.sku,
      name: product.name,
      presentationName:
        selected && !selected.isBase ? selected.name : null,
      unitPrice,
      qty: 1,
      imageUrl: product.imageUrl,
      stockAvailable: product.stockAvailable,
      isCatchWeight: product.isCatchWeight,
      ...(product.pricePerKg != null ? { pricePerKg: product.pricePerKg } : {}),
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
    showToast(`${product.name} añadido al carrito`);
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
          src={product.imageUrl}
          alt={product.name}
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
        {product.name}
      </Heading>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="tabular text-[26px] font-bold text-navy-900">
          {fmt(headlinePrice, currency)}
        </span>
        {showCompare && product.compareAtPrice != null && (
          <span className="tabular text-[14px] text-slate-400 line-through">
            {fmt(product.compareAtPrice, currency)}
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

      {hasSelector && (
        <div className={BLOCK}>
          <p className="eyebrow">Presentación</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {presentations.map((pres) => {
              const active = selected?.sku === pres.sku;
              return (
                <button
                  key={pres.sku}
                  type="button"
                  onClick={() => {
                    setSelected(pres);
                    setSelectedPieceIds([]);
                  }}
                  aria-pressed={active}
                  className={cn(CHIP_BASE, active ? CHIP_ON : CHIP_OFF)}
                >
                  {product.isCatchWeight && pres.estimatedPrice != null
                    ? `${pres.name} · ≈${fmt(pres.estimatedPrice, currency)}`
                    : `${pres.name} · ${fmt(pres.retailPrice, currency)}`}
                </button>
              );
            })}
          </div>
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
        {soldOut
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
