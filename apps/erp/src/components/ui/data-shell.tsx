import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Container for list-client content (filters + table).
 * Provides a consistent card surface with proper padding.
 */
export function DataShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-panel overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Filter bar for lists (search + optional filter chips).
 */
export function DataFilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DataTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn(
          "w-full caption-bottom text-sm",
          className
        )}
      >
        {children}
      </table>
    </div>
  );
}

export function DataTableHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <thead className={cn("bg-muted/40 border-b border-border", className)}>
      {children}
    </thead>
  );
}

export function DataTableBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tbody className={cn("divide-y divide-border/60", className)}>{children}</tbody>;
}

export function DataTableRow({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "group transition-colors hover:bg-[var(--brand)]/[0.04] data-[state=selected]:bg-[var(--brand)]/[0.06]",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function DataTableHeaderCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground whitespace-nowrap",
        className
      )}
    >
      {children}
    </th>
  );
}

export function DataTableCell({
  children,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-4 py-3 text-sm text-foreground align-middle", className)}
      {...props}
    >
      {children}
    </td>
  );
}
