"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Search, SearchX, X } from "lucide-react";
import type { WebstoreCurrency, WebstoreProduct } from "@/lib/erp-client";
import { discountPct, normalizeText } from "@/lib/format";
import { useSyncCurrency } from "@/lib/store";
import { ProductCard } from "@/components/product-card";

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

interface CatalogClientProps {
  products: WebstoreProduct[];
  currency: WebstoreCurrency;
  initialCategory: string;
  initialQuery: string;
  autoFocus: boolean;
  initialOfertas: boolean;
}

export function CatalogClient({
  products,
  currency,
  initialCategory,
  initialQuery,
  autoFocus,
  initialOfertas,
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
        // duplicaría keys y chocaría con el filtro de ofertas.
        .filter((c) => c !== TODO && c !== OFERTAS)
        .sort((a, b) => a.localeCompare(b, "es")),
    [products]
  );

  const [category, setCategory] = useState(() => {
    if (initialOfertas) return OFERTAS;
    return categories.includes(initialCategory) ? initialCategory : TODO;
  });
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortKey>("rel");
  const [inStockOnly, setInStockOnly] = useState(false);

  // Mantiene la URL compartible/navegable sin re-render del server component.
  useEffect(() => {
    const params = new URLSearchParams();
    if (category === OFERTAS) params.set("ofertas", "1");
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

  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const term = normalizeText(deferredQuery.trim());
    const base = products.filter((p) => {
      if (category === OFERTAS) {
        if (p.compareAtPrice == null) return false;
      } else if (category !== TODO && p.category !== category) {
        return false;
      }
      if (inStockOnly && p.stockAvailable <= 0) return false;
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
  }, [products, searchIndex, category, deferredQuery, sort, inStockOnly]);

  const hasActiveFilters =
    category !== TODO || query.trim() !== "" || inStockOnly || sort !== "rel";

  const clearFilters = () => {
    setCategory(TODO);
    setQuery("");
    setSort("rel");
    setInStockOnly(false);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="grad-header anim-fade-up rounded-b-[22px] px-5 py-[18px] text-white md:mt-6 md:rounded-[22px] md:px-7 md:py-6">
        <div className="mb-3 text-[17px] font-bold md:text-[19px]">
          Catálogo
        </div>
        <div className="flex items-center gap-2.5 rounded-[13px] border border-white/15 bg-white/10 px-3.5 py-[11px] transition-colors focus-within:border-white/35 focus-within:bg-white/15 md:max-w-xl">
          <Search className="h-4 w-4 flex-none text-white/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar productos…"
            autoFocus={autoFocus}
            className="flex-1 border-none bg-transparent text-sm text-white placeholder:text-white/60"
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
        {[TODO, OFERTAS, ...categories].map((name) => {
          const active = category === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setCategory(name)}
              className={`flex-none rounded-full border px-[15px] py-2 text-[13px] font-medium transition-colors ${
                active
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-ink-soft hover:border-brand-soft hover:text-brand"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>

      <div className="anim-fade-up flex items-center justify-between gap-2 px-5 pt-2 pb-1 [animation-delay:100ms] md:px-0">
        <div aria-live="polite" className="flex-none text-[12.5px] text-muted">
          {filtered.length}{" "}
          {filtered.length === 1 ? "producto" : "productos"}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setInStockOnly((v) => !v)}
            aria-pressed={inStockOnly}
            className={`flex flex-none items-center gap-1 rounded-lg px-[11px] py-1.5 text-[11.5px] font-medium transition-colors ${
              inStockOnly
                ? "bg-chip text-brand"
                : "bg-transparent text-muted hover:text-brand"
            }`}
          >
            {inStockOnly && <Check className="h-3 w-3" />}
            Disponibles
          </button>
          <div className="relative min-w-0">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Ordenar productos"
              className="w-full max-w-[170px] appearance-none truncate rounded-lg bg-chip py-1.5 pr-7 pl-[11px] text-[11.5px] font-medium text-brand"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-brand" />
          </div>
        </div>
      </div>

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
            <button
              type="button"
              onClick={clearFilters}
              className="mt-1 rounded-xl bg-brand px-[22px] py-[11px] text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-mid"
            >
              Limpiar filtros
            </button>
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
