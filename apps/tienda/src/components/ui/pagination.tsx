"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Múltiplo de 1/2/3/4, las columnas que llega a tener la retícula: ninguna
 *  página deja una fila coja. */
export const DEFAULT_PAGE_SIZE = 24;

export type PaginationState<Item> = {
  page: number;
  pageCount: number;
  pageItems: Item[];
  total: number;
  from: number;
  to: number;
  setPage: (page: number) => void;
};

/** Pagina en memoria una lista ya cargada. `pageSize = 0` la desactiva. */
export function usePagination<Item>(
  items: Item[],
  pageSize: number
): PaginationState<Item> {
  const total = items.length;
  const enabled = pageSize > 0;
  const pageCount = enabled ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  const [page, setPage] = React.useState(1);

  // Al filtrar cambia el total y la página vigente puede quedar fuera de rango.
  // El reinicio va en render y no en un efecto: con efecto se pintaría primero
  // una página vacía y después la corregida.
  const [seenTotal, setSeenTotal] = React.useState(total);
  if (seenTotal !== total) {
    setSeenTotal(total);
    if (page !== 1) setPage(1);
  }

  const safePage = Math.min(page, pageCount);
  const start = enabled ? (safePage - 1) * pageSize : 0;
  const end = enabled ? Math.min(start + pageSize, total) : total;

  const pageItems = React.useMemo(
    () =>
      enabled && (start > 0 || end < total) ? items.slice(start, end) : items,
    [items, enabled, start, end, total]
  );

  return {
    page: safePage,
    pageCount,
    pageItems,
    total,
    from: total === 0 ? 0 : start + 1,
    to: end,
    setPage,
  };
}

const GAP = "gap" as const;
type PageItem = number | typeof GAP;

function pageWindow(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const items: PageItem[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) items.push(GAP);
  for (let p = start; p <= end; p++) items.push(p);
  if (end < pageCount - 1) items.push(GAP);
  items.push(pageCount);
  return items;
}

const PILL =
  "inline-flex size-9 items-center justify-center rounded-full border-[1.5px] transition-colors duration-150";

const ARROW = cn(
  PILL,
  "border-line bg-canvas text-navy-900 hover:border-navy-700 hover:text-navy-700 disabled:pointer-events-none disabled:opacity-40"
);

type PaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
};

export function Pagination({
  page,
  pageCount,
  total,
  from,
  to,
  onPageChange,
  itemLabel = "productos",
  className,
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const go = (next: number) =>
    onPageChange(Math.min(Math.max(next, 1), pageCount));

  return (
    <nav
      aria-label="Paginación"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line pt-6",
        className
      )}
    >
      <p className="tabular text-[12.5px] text-slate-400">
        <span className="font-semibold text-navy-900">
          {from}–{to}
        </span>{" "}
        de <span className="font-semibold text-navy-900">{total}</span>{" "}
        {itemLabel}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={ARROW}
          disabled={page <= 1}
          onClick={() => go(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </button>

        <div className="hidden items-center gap-1.5 sm:flex">
          {pageWindow(page, pageCount).map((item, i) =>
            item === GAP ? (
              <span
                key={`gap-${i}`}
                aria-hidden
                className="px-0.5 text-[12.5px] text-slate-400"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => go(item)}
                aria-label={`Página ${item}`}
                aria-current={item === page ? "page" : undefined}
                className={cn(
                  PILL,
                  "tabular text-[13px] font-medium",
                  item === page
                    ? "border-navy-700 bg-navy-700 font-semibold text-on-brand"
                    : "border-line bg-canvas text-navy-900 hover:border-navy-700 hover:text-navy-700"
                )}
              >
                {item}
              </button>
            )
          )}
        </div>

        <span className="tabular px-2 text-[13px] font-semibold text-slate-500 sm:hidden">
          {page} de {pageCount}
        </span>

        <button
          type="button"
          className={ARROW}
          disabled={page >= pageCount}
          onClick={() => go(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight className="size-4" strokeWidth={2} />
        </button>
      </div>
    </nav>
  );
}
