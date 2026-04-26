"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
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
}: Props<Row>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {toolbar && (
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
        )}
        {rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {emptyState ?? "Sin resultados."}
          </div>
        ) : (
          <div className="space-y-2 pb-24">
            {rows.map((row, i) => (
              <React.Fragment key={rowKey(row, i)}>
                {mobileCard(row, i)}
              </React.Fragment>
            ))}
          </div>
        )}
        {footer && (
          <div className="text-xs text-muted-foreground">{footer}</div>
        )}
      </div>
    );
  }

  return (
    <DataTable<Row>
      columns={columns}
      rows={rows}
      rowKey={rowKey}
      onRowClick={onRowClick}
      emptyState={emptyState}
      toolbar={toolbar}
      footer={footer}
      density={density}
      className={className}
      selectedKeys={selectedKeys}
      onSelectionChange={onSelectionChange}
      isRowSelectable={isRowSelectable}
    />
  );
}
