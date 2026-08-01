"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Filas por página por defecto en listados densos. */
export const DEFAULT_PAGE_SIZE = 25;

export type PaginationState<Row> = {
  page: number;
  pageCount: number;
  pageRows: Row[];
  total: number;
  /** Índice humano de la primera fila visible (1-based); 0 si no hay filas. */
  from: number;
  /** Índice humano de la última fila visible. */
  to: number;
  setPage: (page: number) => void;
};

/**
 * Pagina en memoria un array ya cargado. `pageSize = 0` la desactiva y devuelve
 * las filas tal cual, para listados que deben verse completos (impresión, etc.).
 */
export function usePagination<Row>(
  rows: Row[],
  pageSize: number
): PaginationState<Row> {
  const total = rows.length;
  const enabled = pageSize > 0;
  const pageCount = enabled ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  const [page, setPage] = React.useState(1);

  // Al filtrar cambia el total y la página vigente puede quedar fuera de rango.
  // El reinicio va en render y no en un efecto: con efecto se pintaría primero
  // una página vacía y después la corregida, un parpadeo visible en listas largas.
  const [seenTotal, setSeenTotal] = React.useState(total);
  if (seenTotal !== total) {
    setSeenTotal(total);
    if (page !== 1) setPage(1);
  }

  const safePage = Math.min(page, pageCount);
  const start = enabled ? (safePage - 1) * pageSize : 0;
  const end = enabled ? Math.min(start + pageSize, total) : total;

  const pageRows = React.useMemo(
    () => (enabled && (start > 0 || end < total) ? rows.slice(start, end) : rows),
    [rows, enabled, start, end, total]
  );

  return {
    page: safePage,
    pageCount,
    pageRows,
    total,
    from: total === 0 ? 0 : start + 1,
    to: end,
    setPage,
  };
}

const GAP = "gap" as const;
type PageItem = number | typeof GAP;

/** Ventana de páginas con elipsis: 1 … 4 5 6 … 13. */
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

type PaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
  /** Sustantivo plural para el resumen: "de 312 productos". */
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
  itemLabel,
  className,
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const go = (next: number) => onPageChange(Math.min(Math.max(next, 1), pageCount));
  const atFirst = page <= 1;
  const atLast = page >= pageCount;

  return (
    <nav
      aria-label="Paginación"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2",
        className
      )}
    >
      <p className="text-xs text-muted-foreground">
        <span className="font-mono tabular-nums text-foreground">
          {from}–{to}
        </span>{" "}
        de{" "}
        <span className="font-mono tabular-nums text-foreground">{total}</span>
        {itemLabel ? ` ${itemLabel}` : ""}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={atFirst}
          onClick={() => go(1)}
          aria-label="Primera página"
          className="hidden sm:inline-flex"
        >
          <ChevronsLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={atFirst}
          onClick={() => go(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft />
        </Button>

        <div className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, pageCount).map((item, i) =>
            item === GAP ? (
              <span
                key={`gap-${i}`}
                aria-hidden
                className="px-1 text-xs text-muted-foreground"
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? "soft" : "ghost"}
                size="icon-sm"
                onClick={() => go(item)}
                aria-label={`Página ${item}`}
                aria-current={item === page ? "page" : undefined}
                className="font-mono tabular-nums text-xs"
              >
                {item}
              </Button>
            )
          )}
        </div>

        <span className="px-1 font-mono text-xs tabular-nums text-muted-foreground sm:hidden">
          {page} / {pageCount}
        </span>

        <Button
          variant="ghost"
          size="icon-sm"
          disabled={atLast}
          onClick={() => go(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={atLast}
          onClick={() => go(pageCount)}
          aria-label="Última página"
          className="hidden sm:inline-flex"
        >
          <ChevronsRight />
        </Button>
      </div>
    </nav>
  );
}
