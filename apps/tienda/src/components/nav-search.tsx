"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, Search, SearchX } from "lucide-react";
import type { WebstoreCurrency } from "@/lib/erp-client";
import { DEFAULT_CURRENCY, fmt, normalizeText } from "@/lib/format";
import { MIN_SEARCH_LENGTH, type SearchResponse } from "@/lib/search";
import { ProductImage } from "@/components/product-image";

type Status = "idle" | "loading" | "success" | "error";

const DEBOUNCE_MS = 300;

// Parte el nombre en [antes, coincidencia, después] comparando sin acentos,
// para resaltar el término tal como está escrito en el producto. La
// normalización NFD conserva la longitud en los diacríticos del español, así
// que los índices del texto normalizado valen para el original.
function splitMatch(
  name: string,
  term: string
): [string, string, string] | null {
  const idx = normalizeText(name).indexOf(normalizeText(term));
  if (idx < 0) return null;
  return [
    name.slice(0, idx),
    name.slice(idx, idx + term.length),
    name.slice(idx + term.length),
  ];
}

function HighlightedName({ name, term }: { name: string; term: string }) {
  const parts = splitMatch(name, term);
  if (!parts) return <>{name}</>;
  const [before, match, after] = parts;
  return (
    <>
      {before}
      <span className="font-bold text-navy-900">{match}</span>
      {after}
    </>
  );
}

interface NavSearchProps {
  open: boolean;
  onClose: () => void;
}

export function NavSearch({ open, onClose }: NavSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [currency, setCurrency] = useState<WebstoreCurrency>(DEFAULT_CURRENCY);
  const [activeIndex, setActiveIndex] = useState(-1);

  const term = query.trim();
  const showResults = open && term.length >= MIN_SEARCH_LENGTH;
  const results = response?.results ?? [];

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (term.length < MIN_SEARCH_LENGTH) {
      setStatus("idle");
      setResponse(null);
      return;
    }
    setStatus("loading");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`respondió ${res.status}`);
        const data = (await res.json()) as SearchResponse;
        setResponse(data);
        setCurrency(data.currency ?? DEFAULT_CURRENCY);
        setActiveIndex(-1);
        setStatus("success");
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error("nav-search:", e);
        setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  // Mantener visible la opción activa cuando la lista tiene scroll.
  useEffect(() => {
    if (activeIndex < 0) return;
    document
      .getElementById(`nav-search-opt-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const active = activeIndex >= 0 ? results[activeIndex] : null;
    onClose();
    if (active) {
      router.push(`/producto/${encodeURIComponent(active.sku)}`);
      return;
    }
    router.push(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (!showResults || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    }
  };

  return (
    <div className="absolute inset-x-0 top-full border-b border-line bg-canvas px-5 pt-6 pb-7 md:px-10">
      <form
        role="search"
        onSubmit={submit}
        className="mx-auto flex w-full max-w-[460px] items-center gap-3 border-b border-rule pb-2.5 focus-within:border-navy-900"
      >
        <Search className="h-4 w-4 flex-none text-slate-400" strokeWidth={1.6} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={onKeyDown}
          placeholder="Buscar productos"
          aria-label="Buscar productos"
          role="combobox"
          aria-expanded={showResults}
          aria-controls="nav-search-results"
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `nav-search-opt-${activeIndex}` : undefined
          }
          autoComplete="off"
          className="w-full bg-transparent text-[15px] text-ink placeholder:text-slate-400"
        />
        {status === "loading" && (
          <Loader2
            className="h-4 w-4 flex-none text-slate-400 motion-safe:animate-spin"
            strokeWidth={1.6}
          />
        )}
      </form>

      {showResults && (
        <div
          id="nav-search-results"
          className="mx-auto mt-6 w-full max-w-[460px]"
        >
          {status === "loading" && (
            <div className="space-y-px">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <div className="h-11 w-11 flex-none bg-surface" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-3/4 bg-surface" />
                    <div className="h-2.5 w-2/5 bg-surface" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {status === "error" && (
            <p className="flex items-center gap-2.5 py-4 text-[13px] text-slate-500">
              <SearchX
                className="h-4 w-4 flex-none text-danger"
                strokeWidth={1.6}
              />
              No se pudo buscar. Intenta de nuevo.
            </p>
          )}

          {status === "success" && results.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-[14px] font-semibold text-ink">
                Sin resultados para “{term}”
              </p>
              <p className="mt-1.5 text-[12.5px] text-slate-500">
                Prueba con otro término
              </p>
            </div>
          )}

          {status === "success" && results.length > 0 && (
            <>
              <div
                role="listbox"
                aria-label="Resultados de búsqueda"
                className="max-h-[min(60vh,420px)] overflow-y-auto border-t border-line-soft"
              >
                {results.map((r, i) => (
                  <Link
                    key={r.sku}
                    id={`nav-search-opt-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    href={`/producto/${encodeURIComponent(r.sku)}`}
                    onClick={onClose}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex items-center gap-4 border-b border-line-soft py-3 transition-colors duration-150 ${
                      i === activeIndex ? "bg-hover" : ""
                    }`}
                  >
                    <span className="relative flex h-11 w-11 flex-none items-center justify-center overflow-hidden bg-surface">
                      <ProductImage src={r.imageUrl} alt={r.name} sizes="44px" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink">
                        <HighlightedName name={r.name} term={term} />
                      </span>
                      {r.category && (
                        <span className="eyebrow mt-1 block truncate">
                          {r.category}
                        </span>
                      )}
                    </span>
                    <span className="flex-none text-right">
                      <span className="tabular block text-[14px] font-bold text-navy-900">
                        {fmt(r.price, currency)}
                      </span>
                      {r.compareAtPrice != null && r.compareAtPrice > r.price && (
                        <span className="tabular block text-[11px] text-slate-400 line-through">
                          {fmt(r.compareAtPrice, currency)}
                        </span>
                      )}
                      {r.stockAvailable <= 0 && (
                        <span className="block text-[11px] text-danger">
                          Agotado
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
              <Link
                href={`/catalogo?q=${encodeURIComponent(term)}`}
                onClick={onClose}
                className="nav-label mt-5 inline-block border-b border-navy-900 pb-1 font-bold text-navy-900 transition-colors hover:text-navy-700"
              >
                Ver todos
                {response && response.total > results.length
                  ? ` (${response.total})`
                  : ""}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
