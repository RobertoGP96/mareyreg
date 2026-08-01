"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  DEFAULT_PAGE_SIZE,
  Pagination,
  usePagination,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

type Props<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string | number;
  /** Render function for the mobile card view. */
  mobileCard: (row: Row, index: number) => React.ReactNode;
  /** Optional toolbar (search, filter trigger, bulk actions) — rendered above both views. */
  toolbar?: React.ReactNode;
  /** Optional footer below both views. */
  footer?: React.ReactNode;
  /** Optional empty-state node. */
  emptyState?: React.ReactNode;
  onRowClick?: (row: Row) => void;
  density?: "compact" | "comfortable";
  className?: string;
  /** Selection passthrough to DataTable (desktop only). */
  selectedKeys?: Set<string | number>;
  onSelectionChange?: (next: Set<string | number>) => void;
  isRowSelectable?: (row: Row) => boolean;
  /** Filas por página. `0` desactiva la paginación y renderiza el listado completo. */
  pageSize?: number;
  /** Sustantivo plural para el resumen de paginación: "de 312 productos". */
  itemLabel?: string;
};

export function ResponsiveListView<Row>({
  columns,
  rows,
  rowKey,
  mobileCard,
  toolbar,
  footer,
  emptyState,
  onRowClick,
  density,
  className,
  selectedKeys,
  onSelectionChange,
  isRowSelectable,
  pageSize = DEFAULT_PAGE_SIZE,
  itemLabel,
}: Props<Row>) {
  const isMobile = useIsMobile();
  const { page, pageCount, pageRows, total, from, to, setPage } = usePagination(
    rows,
    pageSize
  );

  const pagination = (
    <Pagination
      page={page}
      pageCount={pageCount}
      total={total}
      from={from}
      to={to}
      onPageChange={setPage}
      itemLabel={itemLabel}
    />
  );

  // La selección de DataTable trabaja sobre las filas visibles: "seleccionar
  // todo" marca la página actual, no el conjunto entero.
  const composedFooter =
    footer || pageCount > 1 ? (
      <div className="flex flex-col gap-2">
        {footer}
        {pagination}
      </div>
    ) : undefined;

  if (isMobile) {
    return (
      <div className={cn("flex flex-col gap-3 pb-24", className)}>
        {toolbar && (
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
        )}
        {total === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {emptyState ?? "Sin resultados."}
          </div>
        ) : (
          <div className="space-y-2">
            {pageRows.map((row, i) => (
              <React.Fragment key={rowKey(row, i)}>
                {mobileCard(row, i)}
              </React.Fragment>
            ))}
          </div>
        )}
        {pageCount > 1 && (
          <div className="rounded-xl border border-border bg-card px-3 py-2">
            {pagination}
          </div>
        )}
        {footer && <div className="text-xs text-muted-foreground">{footer}</div>}
      </div>
    );
  }

  return (
    <DataTable<Row>
      columns={columns}
      rows={pageRows}
      rowKey={rowKey}
      onRowClick={onRowClick}
      emptyState={emptyState}
      toolbar={toolbar}
      footer={composedFooter}
      density={density}
      className={className}
      selectedKeys={selectedKeys}
      onSelectionChange={onSelectionChange}
      isRowSelectable={isRowSelectable}
    />
  );
}
