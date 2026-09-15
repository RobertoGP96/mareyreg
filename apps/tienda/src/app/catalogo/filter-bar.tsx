"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SortOption {
  key: string;
  label: string;
}

/** Chip de filtro del sistema: píldora con borde de 1.5px. `CHIP_ON` es el
 *  estado pleno (categoría elegida); `CHIP_SOFT_ON` el tenue, para
 *  modificadores secundarios (en stock, precio) que no deben competir con la
 *  categoría activa. */
export const CHIP_BASE =
  "flex-none rounded-full border-[1.5px] px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150";
export const CHIP_ON = "border-navy-700 bg-navy-700 text-on-brand";
export const CHIP_SOFT_ON = "border-navy-700 bg-tint text-navy-700";
export const CHIP_OFF =
  "border-line bg-canvas text-slate-500 hover:border-navy-700 hover:text-navy-700";

interface FilterBarProps {
  filters: string[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  count: number;
  /** Sustantivo del contador en singular/plural (por defecto producto/productos). */
  countLabel?: [singular: string, plural: string];
  sort: string;
  sortOptions: SortOption[];
  onSortChange: (sort: string) => void;
  /** Modificadores secundarios (en stock, precio): van junto al orden. */
  children?: React.ReactNode;
}

export function FilterBar({
  filters,
  activeFilter,
  onFilterChange,
  count,
  countLabel = ["producto", "productos"],
  sort,
  sortOptions,
  onSortChange,
  children,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
        {filters.map((filter) => {
          const active = activeFilter === filter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => onFilterChange(filter)}
              aria-pressed={active}
              className={cn(CHIP_BASE, active ? CHIP_ON : CHIP_OFF)}
            >
              {filter}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 md:gap-3 lg:flex-none">
        <span
          aria-live="polite"
          className="tabular text-[12.5px] font-medium text-slate-400 max-sm:hidden"
        >
          {count} {count === 1 ? countLabel[0] : countLabel[1]}
        </span>
        {children}
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger
            aria-label="Ordenar productos"
            className="max-w-[190px] [&>span]:truncate"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {sortOptions.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
