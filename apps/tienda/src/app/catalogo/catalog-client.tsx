"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Check,
  Search,
  SearchX,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import type { WebstoreCurrency, WebstoreProduct } from "@/lib/erp-client";
import { discountPct, fmt, normalizeText } from "@/lib/format";
import { useSyncCurrency } from "@/lib/store";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortKey = "rel" | "asc" | "desc" | "discount" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "rel", label: "Relevancia" },
  { key: "asc", label: "Precio: menor a mayor" },
  { key: "desc", label: "Precio: mayor a menor" },
  { key: "discount", label: "Mayor descuento" },
  { key: "name", label: "Nombre A-Z" },
];

const TODO = "Todo";
const OFERTAS = "Ofertas";
const DESTACADOS = "Destacados";

interface CatalogClientProps {
  products: WebstoreProduct[];
  currency: WebstoreCurrency;
  initialCategory: string;
  initialQuery: string;
  autoFocus: boolean;
  initialOfertas: boolean;
  initialDestacados: boolean;
}

export function CatalogClient({
  products,
  currency,
  initialCategory,
  initialQuery,
  autoFocus,
  initialOfertas,
  initialDestacados,
}: CatalogClientProps) {
  useSyncCurrency(currency);
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((p) => p.category)
            .filter((c): c is string => c != null && c.length > 0)
        )
      )
        // Reservados como chips especiales: una categoría real con ese nombre
        // duplicaría keys y chocaría con los filtros de ofertas/destacados.
        .filter((c) => c !== TODO && c !== OFERTAS && c !== DESTACADOS)
        .sort((a, b) => a.localeCompare(b, "es")),
    [products]
  );

  const [category, setCategory] = useState(() => {
    if (initialOfertas) return OFERTAS;
    if (initialDestacados) return DESTACADOS;
    return categories.includes(initialCategory) ? initialCategory : TODO;
  });
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortKey>("rel");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showPrice, setShowPrice] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);

  // Mantiene la URL compartible/navegable sin re-render del server component.
  useEffect(() => {
    const params = new URLSearchParams();
    if (category === OFERTAS) params.set("ofertas", "1");
    else if (category === DESTACADOS) params.set("destacados", "1");
    else if (category !== TODO) params.set("cat", category);
    const term = query.trim();
    if (term) params.set("q", term);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/catalogo?${qs}` : "/catalogo");
  }, [category, query]);

  // Texto de búsqueda normalizado una sola vez por producto, no por tecla.
  const searchIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      map.set(p.sku, normalizeText(`${p.name} ${p.category ?? ""}`));
    }
    return map;
  }, [products]);

  // null cuando todos los productos cuestan lo mismo: no hay nada que filtrar.
  const priceBounds = useMemo<[number, number] | null>(() => {
    if (products.length === 0) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const p of products) {
      if (p.price < min) min = p.price;
      if (p.price > max) max = p.price;
    }
    min = Math.floor(min);
    max = Math.ceil(max);
    return min < max ? [min, max] : null;
  }, [products]);

  const priceStep = priceBounds
    ? Math.max(1, Math.round((priceBounds[1] - priceBounds[0]) / 100))
    : 1;
  const range: [number, number] = priceRange ?? priceBounds ?? [0, 0];
  const priceActive =
    priceBounds != null &&
    priceRange != null &&
    (priceRange[0] > priceBounds[0] || priceRange[1] < priceBounds[1]);

  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const term = normalizeText(deferredQuery.trim());
    const base = products.filter((p) => {
      if (category === OFERTAS) {
        if (p.compareAtPrice == null) return false;
      } else if (category === DESTACADOS) {
        if (!p.featured) return false;
      } else if (category !== TODO && p.category !== category) {
        return false;
      }
      if (inStockOnly && p.stockAvailable <= 0) return false;
      if (
        priceActive &&
        priceRange != null &&
        (p.price < priceRange[0] || p.price > priceRange[1])
      ) {
        return false;
      }
      if (term && !(searchIndex.get(p.sku) ?? "").includes(term)) return false;
      return true;
    });
    switch (sort) {
      case "asc":
        return [...base].sort((a, b) => a.price - b.price);
      case "desc":
        return [...base].sort((a, b) => b.price - a.price);
      case "discount":
        return [...base].sort((a, b) => discountPct(b) - discountPct(a));
      case "name":
        return [...base].sort((a, b) => a.name.localeCompare(b.name, "es"));
      default:
        return base;
    }
  }, [
    products,
    searchIndex,
    category,
    deferredQuery,
    sort,
    inStockOnly,
    priceActive,
    priceRange,
  ]);

  const hasActiveFilters =
    category !== TODO ||
    query.trim() !== "" ||
    inStockOnly ||
    sort !== "rel" ||
    priceActive;

  const clearFilters = () => {
    setCategory(TODO);
    setQuery("");
    setSort("rel");
    setInStockOnly(false);
    setPriceRange(null);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="grad-header anim-fade-up rounded-b-[22px] px-5 py-[18px] text-white md:mt-6 md:rounded-[22px] md:px-7 md:py-6">
        <div className="mb-3 text-[17px] font-bold md:text-[19px]">
          Catálogo
        </div>
        <div className="flex items-center gap-2.5 rounded-[13px] border border-white/15 bg-white/10 px-3.5 py-[11px] transition-colors focus-within:border-white/35 focus-within:bg-white/15 md:max-w-xl">
          <Search className="h-4 w-4 flex-none text-white/60" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar productos…"
            autoFocus={autoFocus}
            className="h-auto flex-1 rounded-none border-none bg-transparent p-0 text-sm text-white placeholder:text-white/60 focus-visible:border-transparent focus-visible:ring-0"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-white/15 text-white/70 transition-colors hover:bg-white/25 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="anim-fade-up no-scrollbar flex gap-2 overflow-x-auto px-5 pt-3.5 pb-2 [animation-delay:60ms] max-md:sticky max-md:top-0 max-md:z-20 max-md:bg-app/95 max-md:backdrop-blur md:flex-wrap md:overflow-visible md:px-0 md:pt-5">
        {[TODO, DESTACADOS, OFERTAS, ...categories].map((name) => {
          const active = category === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setCategory(name)}
              className={`inline-flex flex-none items-center gap-1 rounded-full border px-[15px] py-2 text-[13px] font-medium transition-colors ${
                active
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-ink-soft hover:border-brand-soft hover:text-brand"
              }`}
            >
              {name === DESTACADOS && (
                <Star className="h-3 w-3" fill="currentColor" />
              )}
              {name}
            </button>
          );
        })}
      </div>

      <div className="anim-fade-up flex items-center justify-between gap-2 px-5 pt-2 pb-1 [animation-delay:100ms] md:px-0">
        <div aria-live="polite" className="flex-none text-[12.5px] text-muted">
          {filtered.length} {filtered.length === 1 ? "producto" : "productos"}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            size="sm"
            variant={inStockOnly ? "chip" : "ghost"}
            onClick={() => setInStockOnly((v) => !v)}
            aria-pressed={inStockOnly}
          >
            {inStockOnly && <Check className="h-3 w-3" />}
            En stock
          </Button>
          {priceBounds && (
            <Button
              size="sm"
              variant={showPrice || priceActive ? "chip" : "ghost"}
              onClick={() => setShowPrice((v) => !v)}
              aria-expanded={showPrice}
              aria-label="Filtro de precio"
            >
              <SlidersHorizontal className="h-3 w-3" />
              Precio
            </Button>
          )}
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as SortKey)}
          >
            <SelectTrigger
              aria-label="Ordenar productos"
              className="min-w-0 max-w-[150px] [&>span]:truncate"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SORTS.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showPrice && priceBounds && (
        <div className="anim-fade-up mx-5 mt-1.5 rounded-2xl bg-white p-4 shadow-[0_3px_12px_rgba(10,31,63,.06)] md:mx-0 md:max-w-md">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[12.5px] font-semibold text-navy">Precio</div>
            <div className="font-mono text-[12px] font-medium tabular-nums text-brand">
              {fmt(range[0], currency)} – {fmt(range[1], currency)}
            </div>
          </div>
          <Slider
            min={priceBounds[0]}
            max={priceBounds[1]}
            step={priceStep}
            value={range}
            onValueChange={(v) => setPriceRange([v[0], v[1]])}
            aria-label="Rango de precio"
            className="mt-3.5"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="text-[11px] text-muted">
              {fmt(priceBounds[0], currency)} a {fmt(priceBounds[1], currency)}
            </div>
            {priceActive && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPriceRange(null)}
              >
                Restablecer
              </Button>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="anim-fade-up flex flex-1 flex-col items-center justify-center gap-3 px-5 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-chip text-brand">
            <SearchX className="h-6 w-6" />
          </div>
          <div className="text-[15px] font-semibold text-navy">
            Sin resultados
          </div>
          <div className="text-[13px] text-muted">
            {hasActiveFilters
              ? "No encontramos productos con esos filtros."
              : "Aún no hay productos disponibles."}
          </div>
          {hasActiveFilters && (
            <Button onClick={clearFilters} className="mt-1">
              Limpiar filtros
            </Button>
          )}
        </div>
      ) : (
        <div className="anim-fade-up grid grid-cols-2 gap-3.5 px-5 pt-2 pb-6 [animation-delay:140ms] md:grid-cols-3 md:gap-5 md:px-0 md:pt-4 lg:grid-cols-4">
          {filtered.map((product, index) => (
            <ProductCard
              key={product.sku}
              product={product}
              variant="grid"
              priority={index < 4}
            />
          ))}
        </div>
      )}
    </div>
  );
}
