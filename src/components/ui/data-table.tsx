"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Align = "left" | "center" | "right";

export type DataTableColumn<Row> = {
  key: string;
  header: React.ReactNode;
  align?: Align;
  width?: string; // tailwind width class e.g. "w-32" or arbitrary "min-w-[200px]"
  className?: string;
  cell: (row: Row, index: number) => React.ReactNode;
};

type SelectionProps<Row> = {
  /** Set of selected row keys. Pass undefined to disable selection. */
  selectedKeys?: Set<string | number>;
  /** Notified when selection changes. */
  onSelectionChange?: (next: Set<string | number>) => void;
  /** Whether a given row is selectable (default: all selectable). */
  isRowSelectable?: (row: Row) => boolean;
};

type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string | number;
  onRowClick?: (row: Row) => void;
  emptyState?: React.ReactNode;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  density?: "compact" | "comfortable";
  className?: string;
  stickyHeader?: boolean;
} & SelectionProps<Row>;

const ALIGN: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyState,
  toolbar,
  footer,
  density = "comfortable",
  className,
  stickyHeader = true,
  selectedKeys,
  onSelectionChange,
  isRowSelectable,
}: DataTableProps<Row>) {
  const cellPad = density === "compact" ? "px-3 py-2" : "px-3.5 py-3";
  const selectable = !!selectedKeys && !!onSelectionChange;

  const selectableKeys = React.useMemo(() => {
    if (!selectable) return [] as (string | number)[];
    return rows
      .filter((r) => (isRowSelectable ? isRowSelectable(r) : true))
      .map((r, i) => rowKey(r, i));
  }, [rows, rowKey, selectable, isRowSelectable]);

  const allSelected =
    selectable &&
    selectableKeys.length > 0 &&
    selectableKeys.every((k) => selectedKeys!.has(k));
  const someSelected =
    selectable &&
    !allSelected &&
    selectableKeys.some((k) => selectedKeys!.has(k));

  const headerCheckboxRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const toggleAll = () => {
    if (!selectable) return;
    const next = new Set(selectedKeys!);
    if (allSelected) {
      for (const k of selectableKeys) next.delete(k);
    } else {
      for (const k of selectableKeys) next.add(k);
    }
    onSelectionChange!(next);
  };

  const toggleRow = (key: string | number) => {
    if (!selectable) return;
    const next = new Set(selectedKeys!);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange!(next);
  };

  return (
    <div className={cn("cockpit-panel overflow-hidden", className)}>
      {toolbar && (
        <div className="border-b border-border bg-muted/30 px-3 py-2.5">
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead
            className={cn(
              "bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
              stickyHeader && "sticky top-0 z-10"
            )}
          >
            <tr>
              {selectable && (
                <th
                  scope="col"
                  className={cn(cellPad, "border-b border-border w-10")}
                >
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Seleccionar todo"
                    className="size-4 cursor-pointer rounded border-border accent-[var(--ops-active)]"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    cellPad,
                    "border-b border-border whitespace-nowrap",
                    ALIGN[col.align ?? "left"],
                    col.width,
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-3 py-12 text-center"
                >
                  {emptyState ?? (
                    <span className="text-sm text-muted-foreground">Sin resultados.</span>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const k = rowKey(row, i);
                const canSelect = selectable && (isRowSelectable ? isRowSelectable(row) : true);
                const isSelected = selectable && selectedKeys!.has(k);
                return (
                  <tr
                    key={k}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-b border-border/60 last:border-0 transition-colors",
                      onRowClick && "cursor-pointer hover:bg-muted/40",
                      "focus-within:bg-muted/40",
                      isSelected && "bg-[var(--ops-active)]/[0.06]"
                    )}
                  >
                    {selectable && (
                      <td className={cn(cellPad, "align-middle w-10")}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!canSelect}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleRow(k)}
                          aria-label="Seleccionar fila"
                          className="size-4 cursor-pointer rounded border-border accent-[var(--ops-active)] disabled:opacity-30"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          cellPad,
                          "align-middle",
                          ALIGN[col.align ?? "left"],
                          col.className
                        )}
                      >
                        {col.cell(row, i)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {footer && (
        <div className="border-t border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}
