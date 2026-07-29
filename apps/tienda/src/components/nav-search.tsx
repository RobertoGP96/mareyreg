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
      <span className="font-bold text-brand">{match}</span>
      {after}
    </>
  );
}

export function NavSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [currency, setCurrency] = useState<WebstoreCurrency>(DEFAULT_CURRENCY);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const term = query.trim();
  const showPopover = open && term.length >= MIN_SEARCH_LENGTH;
  const results = response?.results ?? [];

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

  // Cerrar al hacer clic fuera del buscador.
  useEffect(() => {
    if (!showPopover) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [showPopover]);

  // Cerrar al navegar (clic en un resultado, enter, links del nav).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Mantener visible la opción activa cuando la lista tiene scroll.
  useEffect(() => {
    if (activeIndex < 0) return;
    document
      .getElementById(`nav-search-opt-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const active = activeIndex >= 0 ? results[activeIndex] : null;
    setOpen(false);
    if (active) {
      router.push(`/producto/${encodeURIComponent(active.sku)}`);
      return;
    }
    router.push(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!showPopover || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    }
  };

  return (
    <div ref={rootRef} className="relative ml-auto w-full max-w-xs flex-1">
      <form
        role="search"
        onSubmit={submit}
        className="flex items-center gap-2.5 rounded-[13px] border border-white/15 bg-white/10 px-3.5 py-2 transition-colors focus-within:border-white/35 focus-within:bg-white/15"
      >
        <Search className="h-4 w-4 flex-none text-white/60" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
            setOpen(e.target.value.trim().length >= MIN_SEARCH_LENGTH);
          }}
          onFocus={() => setOpen(term.length >= MIN_SEARCH_LENGTH)}
          onKeyDown={onKeyDown}
          placeholder="Buscar productos…"
          aria-label="Buscar productos"
          role="combobox"
          aria-expanded={showPopover}
          aria-controls="nav-search-results"
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `nav-search-opt-${activeIndex}` : undefined
          }
          autoComplete="off"
          className="w-full border-none bg-transparent text-[13px] text-white placeholder:text-white/60"
        />
        {status === "loading" && (
          <Loader2 className="h-4 w-4 flex-none text-white/70 motion-safe:animate-spin" />
        )}
      </form>

      {showPopover && (
        <div
          id="nav-search-results"
          className="anim-fade-up absolute inset-x-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_16px_40px_rgba(10,31,63,.22)]"
        >
          {status === "loading" && (
            <div>
              <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2 text-[13px] font-medium text-ink-soft">
                <Loader2 className="h-4 w-4 text-brand motion-safe:animate-spin" />
                Buscando “{term}”…
              </div>
              <div className="space-y-2 px-4 pb-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-10 w-10 flex-none rounded-[10px] bg-photo motion-safe:animate-pulse" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 rounded bg-line-2 motion-safe:animate-pulse" />
                      <div className="h-2.5 w-2/5 rounded bg-line-2 motion-safe:animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-2.5 px-4 py-4 text-[13px] text-ink-soft">
              <SearchX className="h-4 w-4 flex-none text-danger" />
              No se pudo buscar. Intenta de nuevo.
            </div>
          )}

          {status === "success" && results.length === 0 && (
            <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
              <SearchX className="h-5 w-5 text-muted" />
              <p className="text-[13px] font-medium text-ink">
                Sin resultados para “{term}”
              </p>
              <p className="text-[12px] text-muted">Prueba con otro término</p>
            </div>
          )}

          {status === "success" && results.length > 0 && (
            <>
              <div
                role="listbox"
                aria-label="Resultados de búsqueda"
                className="max-h-[min(60vh,420px)] overflow-y-auto py-1.5"
              >
                {results.map((r, i) => (
                  <Link
                    key={r.sku}
                    id={`nav-search-opt-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    href={`/producto/${encodeURIComponent(r.sku)}`}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      i === activeIndex ? "bg-chip" : ""
                    }`}
                  >
                    <span className="relative flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-[10px] bg-photo text-[9px] font-semibold text-photo-fg">
                      <ProductImage src={r.imageUrl} alt={r.name} sizes="40px" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        <HighlightedName name={r.name} term={term} />
                      </span>
                      {r.category && (
                        <span className="block truncate text-[11px] text-muted">
                          {r.category}
                        </span>
                      )}
                    </span>
                    <span className="flex-none text-right">
                      <span className="block font-mono text-[13px] font-semibold tabular-nums text-brand">
                        {fmt(r.price, currency)}
                      </span>
                      {r.compareAtPrice != null && r.compareAtPrice > r.price && (
                        <span className="block font-mono text-[11px] tabular-nums text-muted line-through">
                          {fmt(r.compareAtPrice, currency)}
                        </span>
                      )}
                      {r.stockAvailable <= 0 && (
                        <span className="block text-[10px] font-semibold text-danger">
                          Agotado
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
              <Link
                href={`/catalogo?q=${encodeURIComponent(term)}`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 border-t border-line-2 px-4 py-2.5 text-[12.5px] font-semibold text-brand transition-colors hover:bg-chip/60"
              >
                Ver todos los resultados
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
