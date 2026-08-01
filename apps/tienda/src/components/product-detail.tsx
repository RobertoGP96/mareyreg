"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Heart, Minus, Plus, Truck } from "lucide-react";
import type {
  WebstoreCurrency,
  WebstoreProduct,
  WebstoreProductPresentation,
} from "@/lib/erp-client";
import { discountPct, fmt } from "@/lib/format";
import { FREE_SHIPPING_TARGET } from "@/lib/cart-totals";
import { useStore, type CartLine } from "@/lib/store";
import { ProductImage } from "@/components/product-image";
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

const BLOCK = "mt-7 border-t border-line-soft pt-7";

const CHIP_BASE =
  "tabular flex-none border px-4 py-2.5 text-[12px] transition-colors duration-150";
const CHIP_ON = "border-navy-900 font-bold text-navy-900";
const CHIP_OFF =
  "border-line text-slate-500 hover:border-navy-900 hover:text-navy-900";

const STEP_BTN =
  "flex h-9 w-9 items-center justify-center text-slate-400 transition-colors duration-150 hover:text-navy-900";

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
      className={`relative w-full overflow-hidden bg-surface ${
        isDrawer ? "aspect-[4/3]" : "aspect-square md:sticky md:top-[78px]"
      }`}
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
        <Badge variant="featured" className="absolute top-0 left-0">
          Destacado
        </Badge>
      )}
      {soldOut && (
        <Badge variant="soldout" className="absolute top-0 left-0">
          Agotado
        </Badge>
      )}
      {!soldOut && pct > 0 && (
        <Badge variant="discount" className="absolute top-0 right-0">
          −{pct}%
        </Badge>
      )}
      <button
        type="button"
        onClick={() => toggleFav(product.sku)}
        aria-label={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
        aria-pressed={isFav}
        className={`absolute right-0 bottom-0 flex h-11 w-11 items-center justify-center bg-canvas transition-colors duration-150 ${
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
  );

  const Heading = isDrawer ? "h2" : "h1";

  const info = (
    <>
      {product.category && <p className="eyebrow">{product.category}</p>}
      <Heading
        className={`font-display mt-5 leading-[1.1] text-balance text-navy-900 ${
          isDrawer ? "text-[24px]" : "text-[30px] md:text-[40px]"
        }`}
      >
        {product.name}
      </Heading>

      <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="tabular text-[26px] font-bold text-navy-900">
          {fmt(headlinePrice, currency)}
        </span>
        {showCompare && product.compareAtPrice != null && (
          <span className="tabular text-[14px] text-slate-400 line-through">
            {fmt(product.compareAtPrice, currency)}
          </span>
        )}
        <span className="text-[12px] text-slate-400">/ {headlineUnit}</span>
      </div>
      {product.isCatchWeight && !usePieceSelection && (
        <p className="mt-2.5 text-[12px] leading-[1.6] text-slate-400">
          Precio estimado · el total se ajusta al peso real al preparar tu
          pedido
        </p>
      )}
      {usePieceSelection && (
        <p className="mt-2.5 text-[12px] leading-[1.6] text-slate-400">
          Elige tu pieza exacta · pagas por su peso real
        </p>
      )}

      <StockLabel stock={product.stockAvailable} className="mt-4" />

      {product.offer && (
        <div className={BLOCK}>
          <p className="eyebrow">Oferta</p>
          <p className="mt-3.5 text-[14px] font-semibold text-ink">
            {product.offer.name}
          </p>
          {offerEndsAtLabel && (
            <p className="mt-1.5 text-[12px] text-slate-400">
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
          <div className="mt-4 flex flex-wrap gap-2.5">
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
                  className={`${CHIP_BASE} ${active ? CHIP_ON : CHIP_OFF}`}
                >
                  {product.isCatchWeight && pres.estimatedPrice != null
                    ? `${pres.name} · ≈${fmt(pres.estimatedPrice, currency)}`
                    : `${pres.name} · ${fmt(pres.retailPrice, currency)}`}
                </button>
              );
            })}
          </div>
          {selected?.wholesalePrice != null && (
            <p className="tabular mt-3.5 text-[12px] text-slate-400">
              Mayoreo: {fmt(selected.wholesalePrice, currency)}
            </p>
          )}
        </div>
      )}

      {usePieceSelection && (
        <div className={BLOCK}>
          <p className="eyebrow">Piezas disponibles</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {matchingPieces.map((p) => {
              const active = selectedPieceIds.includes(p.pieceId);
              return (
                <button
                  key={p.pieceId}
                  type="button"
                  onClick={() => togglePiece(p.pieceId)}
                  aria-pressed={active}
                  className={`${CHIP_BASE} ${active ? CHIP_ON : CHIP_OFF}`}
                >
                  {p.weightKg.toFixed(2)} kg · {fmt(p.price ?? 0, currency)}
                </button>
              );
            })}
          </div>
          <p className="mt-3.5 text-[12px] leading-[1.6] text-slate-400">
            Selecciona una o varias piezas; cada una se cobra por su peso real.
          </p>
        </div>
      )}

      {!usePieceSelection && (
        <div className={BLOCK}>
          <div className="flex items-center justify-between gap-5">
            <span className="eyebrow">Cantidad</span>
            <div className="flex items-center border-b border-rule">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Disminuir cantidad"
                className={STEP_BTN}
              >
                <Minus className="h-4 w-4" strokeWidth={1.6} />
              </button>
              <span className="tabular w-10 text-center text-[15px] font-semibold text-ink">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                aria-label="Aumentar cantidad"
                className={STEP_BTN}
              >
                <Plus className="h-4 w-4" strokeWidth={1.6} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const cta = (
    <>
      <div className="flex items-baseline justify-between gap-5">
        <span className="text-[12px] text-slate-400">
          Total{" "}
          <span className="tabular">
            {usePieceSelection
              ? `(${piecesLabel})`
              : `(${qty} × ${fmt(unitPrice, currency)})`}
          </span>
        </span>
        <span className="tabular text-[19px] font-bold text-navy-900">
          {fmt(displayTotal, currency)}
        </span>
      </div>
      {product.isCatchWeight && !usePieceSelection && (
        <p className="mt-2.5 text-[12px] leading-[1.6] text-slate-400">
          El total se ajusta al peso real al preparar tu pedido
        </p>
      )}
      {usePieceSelection && (
        <p className="mt-2.5 text-[12px] leading-[1.6] text-slate-400">
          Precio real por pieza — sin ajustes al preparar tu pedido
        </p>
      )}

      <Button
        variant="solid"
        size="lg"
        onClick={handleAdd}
        aria-disabled={addDisabled}
        className={`mt-6 w-full ${
          addDisabled ? "cursor-not-allowed bg-disabled hover:bg-disabled" : ""
        }`}
      >
        {soldOut
          ? "Agotado"
          : usePieceSelection
            ? "Añadir piezas"
            : "Añadir a la bolsa"}
      </Button>

      <p className="tabular mt-4 flex items-center gap-2 text-[12px] text-slate-400">
        <Truck className="h-4 w-4 flex-none" strokeWidth={1.6} />
        Envío gratis en pedidos desde {fmt(FREE_SHIPPING_TARGET, currency)}
      </p>
    </>
  );

  if (isDrawer) {
    return (
      <div className="flex flex-col">
        {media}
        <div className="flex flex-col px-5 pt-7">{info}</div>
        {/* Pegado al borde de la hoja: en una lista larga de presentaciones o
            pesajes el CTA quedaría fuera de alcance al final del scroll. */}
        <div className="sticky bottom-0 mt-7 border-t border-line bg-canvas px-5 pt-5 pb-6">
          {cta}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2">
      <div className="border-b border-line md:border-r md:border-b-0">
        {media}
      </div>
      <div className="flex flex-col px-5 py-9 md:px-10 md:py-12">
        {info}
        <div className={BLOCK}>{cta}</div>
      </div>
    </div>
  );
}
