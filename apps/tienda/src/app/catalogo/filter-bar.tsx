"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SortOption {
  key: string;
  label: string;
}

interface FilterBarProps {
  filters: string[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  count: number;
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
  sort,
  sortOptions,
  onSortChange,
  children,
}: FilterBarProps) {
  return (
    <div className="border-b border-line px-5 md:px-10">
      <div className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="no-scrollbar -mx-5 flex gap-6 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
          {filters.map((filter) => {
            const active = activeFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => onFilterChange(filter)}
                aria-pressed={active}
                className={`nav-label flex-none transition-colors duration-150 ${
                  active
                    ? "font-bold text-navy-900"
                    : "text-slate-400 hover:text-navy-700"
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>

        <div className="flex flex-none items-center gap-6">
          <span
            aria-live="polite"
            className="nav-label text-slate-400 max-sm:hidden"
          >
            {count} {count === 1 ? "producto" : "productos"}
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
    </div>
  );
}
