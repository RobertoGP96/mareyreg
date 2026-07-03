"use client";

import { useMemo, useState } from "react";
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
      <div className="grad-header rounded-b-[22px] px-5 py-[18px] text-white">
        <div className="mb-3 text-[17px] font-bold">Catálogo</div>
        <div className="flex items-center gap-2.5 rounded-[13px] border border-white/15 bg-white/10 px-3.5 py-[11px]">
          <span className="text-white/60">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar productos…"
            autoFocus={autoFocus}
            className="flex-1 border-none bg-transparent text-sm text-white placeholder:text-white/60"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto px-5 pt-3.5 pb-1">
        {["Todo", OFERTAS, ...categories].map((name) => {
          const active = category === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setCategory(name)}
              className={`flex-none rounded-full border px-[15px] py-2 text-[13px] font-medium ${
                active
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-ink-soft"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-5 pt-3 pb-1">
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
                className={`rounded-lg px-[11px] py-1.5 text-[11.5px] font-medium ${
                  active ? "bg-chip text-brand" : "bg-transparent text-muted"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 px-5 pt-2 pb-6">
        {filtered.map((product) => (
          <ProductCard key={product.sku} product={product} variant="grid" />
        ))}
      </div>
    </div>
  );
}
