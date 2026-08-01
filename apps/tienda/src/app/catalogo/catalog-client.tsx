"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { WebstoreCurrency, WebstoreProduct } from "@/lib/erp-client";
import { discountPct, fmt, normalizeText } from "@/lib/format";
import { useSyncCurrency } from "@/lib/store";
import { ProductCard } from "@/components/product-card";
import { ProductGrid, ProductGridCell } from "@/components/product-grid";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PAGE_SIZE,
  Pagination,
  usePagination,
} from "@/components/ui/pagination";
import { Slider } from "@/components/ui/slider";
import { CatalogHero } from "@/app/catalogo/catalog-hero";
import { FilterBar, type SortOption } from "@/app/catalogo/filter-bar";

type SortKey = "rel" | "asc" | "desc" | "discount" | "name";

const SORTS: SortOption[] = [
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
  initialOfertas: boolean;
  initialDestacados: boolean;
}

export function CatalogClient({
  products,
  currency,
  initialCategory,
  initialQuery,
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
        // Reservados como filtros especiales: una categoría real con ese nombre
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

  const { page, pageCount, pageItems, total, from, to, setPage } = usePagination(
    filtered,
    DEFAULT_PAGE_SIZE
  );

  const gridRef = useRef<HTMLDivElement>(null);

  // Cambiar de página sin volver al inicio de la retícula deja al usuario a
  // mitad de una lista que ya no es la que estaba leyendo.
  const goToPage = (next: number) => {
    setPage(next);
    const el = gridRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      // El header es sticky (78px): sin holgura la primera fila queda debajo.
      top: el.getBoundingClientRect().top + window.scrollY - 90,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  const activeTerm = query.trim();

  const hasActiveFilters =
    category !== TODO ||
    activeTerm !== "" ||
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
      <CatalogHero
        eyebrow="Selección 2026"
        title="Catálogo"
        description="Despensa escogida pieza a pieza. Productos frescos, marcas de confianza y precios claros, sin adornos."
      />

      <FilterBar
        filters={[TODO, DESTACADOS, OFERTAS, ...categories]}
        activeFilter={category}
        onFilterChange={setCategory}
        count={filtered.length}
        sort={sort}
        sortOptions={SORTS}
        onSortChange={(value) => setSort(value as SortKey)}
      >
        <button
          type="button"
          onClick={() => setInStockOnly((v) => !v)}
          aria-pressed={inStockOnly}
          className={`nav-label transition-colors duration-150 ${
            inStockOnly
              ? "font-bold text-navy-900"
              : "text-slate-400 hover:text-navy-700"
          }`}
        >
          En stock
        </button>
        {priceBounds && (
          <button
            type="button"
            onClick={() => setShowPrice((v) => !v)}
            aria-expanded={showPrice}
            className={`nav-label transition-colors duration-150 ${
              showPrice || priceActive
                ? "font-bold text-navy-900"
                : "text-slate-400 hover:text-navy-700"
            }`}
          >
            Precio
          </button>
        )}
      </FilterBar>

      {/* El catálogo ya no tiene buscador propio: el término llega por `?q=`
          desde el buscador del header. Sin pintarlo, el usuario ve una lista
          recortada sin saber por qué y sin manera de deshacerlo. */}
      {activeTerm && (
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 md:px-10">
          <p className="flex min-w-0 items-center gap-3">
            <Search
              className="h-4 w-4 flex-none text-slate-400"
              strokeWidth={1.6}
            />
            <span className="truncate text-[13px] text-slate-500">
              Resultados para{" "}
              <span className="font-semibold text-navy-900">“{activeTerm}”</span>
            </span>
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="nav-label inline-flex flex-none items-center gap-1.5 text-slate-400 transition-colors duration-150 hover:text-navy-900"
          >
            Quitar
            <X className="h-3.5 w-3.5" strokeWidth={1.6} />
          </button>
        </div>
      )}

      {showPrice && priceBounds && (
        <div className="border-b border-line px-5 py-6 md:px-10">
          <div className="max-w-[460px]">
            <div className="flex items-baseline justify-between gap-4">
              <span className="eyebrow">Rango de precio</span>
              <span className="tabular text-[13px] font-bold text-navy-900">
                {fmt(range[0], currency)} – {fmt(range[1], currency)}
              </span>
            </div>
            <Slider
              min={priceBounds[0]}
              max={priceBounds[1]}
              step={priceStep}
              value={range}
              onValueChange={(v) => setPriceRange([v[0], v[1]])}
              aria-label="Rango de precio"
              className="mt-4"
            />
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="tabular text-[11px] text-slate-400">
                {fmt(priceBounds[0], currency)} — {fmt(priceBounds[1], currency)}
              </span>
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
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-24 text-center md:px-10">
          <p className="eyebrow">Sin resultados</p>
          <p className="font-display mt-4 text-[32px] leading-none text-navy-900">
            Nada por aquí
          </p>
          <p className="mt-4 max-w-[380px] text-[13.5px] leading-[1.65] text-pretty text-slate-500">
            {activeTerm
              ? `No encontramos nada para “${activeTerm}”. Prueba con otro término o quita algún filtro.`
              : hasActiveFilters
                ? "No encontramos productos con esos filtros. Prueba a quitar alguno."
                : "Aún no hay productos disponibles en el catálogo."}
          </p>
          {hasActiveFilters && (
            <Button onClick={clearFilters} className="mt-7">
              Limpiar filtros
            </Button>
          )}
        </div>
      ) : (
        <div ref={gridRef} className="px-5 pb-16 md:px-10">
          <ProductGrid>
            {pageItems.map((product, index) => (
              <ProductGridCell key={product.sku}>
                <ProductCard
                  product={product}
                  variant="grid"
                  priority={page === 1 && index < 4}
                />
              </ProductGridCell>
            ))}
          </ProductGrid>
          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            from={from}
            to={to}
            onPageChange={goToPage}
            className="mt-12"
          />
        </div>
      )}
    </div>
  );
}
