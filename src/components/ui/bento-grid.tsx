import * as React from "react";
import { cn } from "@/lib/utils";

type BentoGridProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Espaciado entre celdas. */
  gap?: "sm" | "md";
  /** Altura mínima de cada fila. */
  rowMin?: "sm" | "md" | "lg";
};

const GAP: Record<NonNullable<BentoGridProps["gap"]>, string> = {
  sm: "gap-2 md:gap-3",
  md: "gap-3 md:gap-4",
};

const ROW_MIN: Record<NonNullable<BentoGridProps["rowMin"]>, string> = {
  sm: "auto-rows-[minmax(96px,auto)]",
  md: "auto-rows-[minmax(120px,auto)]",
  lg: "auto-rows-[minmax(150px,auto)]",
};

export function BentoGrid({
  className,
  gap = "md",
  rowMin = "md",
  children,
  ...rest
}: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12",
        GAP[gap],
        ROW_MIN[rowMin],
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

type Span = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
type RowSpan = 1 | 2 | 3;

const COL_BASE: Record<1, string> = { 1: "col-span-1" };

const COL_MD: Partial<Record<Span, string>> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
};

const COL_LG: Partial<Record<Span, string>> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  9: "lg:col-span-9",
  10: "lg:col-span-10",
  11: "lg:col-span-11",
  12: "lg:col-span-12",
};

const ROW_MD: Record<RowSpan, string> = {
  1: "md:row-span-1",
  2: "md:row-span-2",
  3: "md:row-span-3",
};

const ROW_LG: Record<RowSpan, string> = {
  1: "lg:row-span-1",
  2: "lg:row-span-2",
  3: "lg:row-span-3",
};

type BentoCellProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Span en cada breakpoint. base siempre 1 col (mobile-first). */
  colSpan?: { md?: Span; lg?: Span };
  /** Filas que ocupa la celda. */
  rowSpan?: { md?: RowSpan; lg?: RowSpan };
};

export function BentoCell({
  className,
  colSpan,
  rowSpan,
  children,
  ...rest
}: BentoCellProps) {
  const md = colSpan?.md ? COL_MD[colSpan.md] : undefined;
  const lg = colSpan?.lg ? COL_LG[colSpan.lg] : undefined;
  const rmd = rowSpan?.md ? ROW_MD[rowSpan.md] : undefined;
  const rlg = rowSpan?.lg ? ROW_LG[rowSpan.lg] : undefined;

  return (
    <div
      className={cn(COL_BASE[1], md, lg, rmd, rlg, "min-w-0", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
