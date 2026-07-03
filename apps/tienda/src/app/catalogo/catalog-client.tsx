"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { WebstoreProduct } from "@/lib/erp-client";
import { ProductCard } from "@/components/product-card";

type SortKey = "rel" | "asc" | "desc";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "rel", label: "Relevancia" },
  { key: "asc", label: "Precio ↑" },
  { key: "desc", label: "Precio ↓" },
];

const OFERTAS = "Ofertas";

interface CatalogClientProps {
  products: WebstoreProduct[];
  initialCategory: string;
  initialQuery: string;
  autoFocus: boolean;
  initialOfertas: boolean;
}

export function CatalogClient({
  products,
  initialCategory,
  initialQuery,
  autoFocus,
  initialOfertas,
}: CatalogClientProps) {
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((p) => p.category)
            .filter((c): c is string => c != null && c.length > 0)
        )
      ),
    [products]
  );

  const [category, setCategory] = useState(() => {
    if (initialOfertas) return OFERTAS;
    return categories.includes(initialCategory) ? initialCategory : "Todo";
  });
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortKey>("rel");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const base = products
      .filter((p) => {
        if (category === "Todo") return true;
        if (category === OFERTAS) return p.compareAtPrice != null;
        return p.category === category;
      })
      .filter((p) => !term || p.name.toLowerCase().includes(term));
    if (sort === "asc") return [...base].sort((a, b) => a.price - b.price);
    if (sort === "desc") return [...base].sort((a, b) => b.price - a.price);
    return base;
  }, [products, category, query, sort]);

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
        </div>
      </div>

      <div className="anim-fade-up flex gap-2 overflow-x-auto px-5 pt-3.5 pb-1 [animation-delay:60ms] md:flex-wrap md:overflow-visible md:px-0 md:pt-5">
        {["Todo", OFERTAS, ...categories].map((name) => {
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

      <div className="anim-fade-up flex items-center justify-between px-5 pt-3 pb-1 [animation-delay:100ms] md:px-0">
        <div className="text-[12.5px] text-muted">
          {filtered.length} productos
        </div>
        <div className="flex gap-1.5">
          {SORTS.map((s) => {
            const active = sort === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={`rounded-lg px-[11px] py-1.5 text-[11.5px] font-medium transition-colors ${
                  active
                    ? "bg-chip text-brand"
                    : "bg-transparent text-muted hover:text-brand"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="anim-fade-up grid grid-cols-2 gap-3.5 px-5 pt-2 pb-6 [animation-delay:140ms] md:grid-cols-3 md:gap-5 md:px-0 md:pt-4 lg:grid-cols-4">
        {filtered.map((product) => (
          <ProductCard key={product.sku} product={product} variant="grid" />
        ))}
      </div>
    </div>
  );
}
