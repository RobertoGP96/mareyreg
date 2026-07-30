"use client";

import { Search, X } from "lucide-react";

interface CatalogHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export function CatalogHero({
  eyebrow,
  title,
  description,
  value,
  onChange,
  autoFocus = false,
}: CatalogHeroProps) {
  return (
    <section className="border-b border-line px-5 pt-[58px] pb-[46px] text-center md:px-10">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="font-display mt-5 text-[42px] leading-none text-navy-900 md:text-[66px]">
        {title}
      </h1>
      <p className="mx-auto mt-5 max-w-[470px] text-[14px] leading-[1.65] text-pretty text-slate-500">
        {description}
      </p>

      <div className="mx-auto mt-9 flex w-full max-w-[460px] items-center gap-3 border-b border-rule pb-2.5 transition-colors focus-within:border-navy-900">
        <Search className="h-4 w-4 flex-none text-slate-400" strokeWidth={1.6} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar en el catálogo"
          aria-label="Buscar en el catálogo"
          autoFocus={autoFocus}
          autoComplete="off"
          className="w-full bg-transparent text-[14px] text-ink placeholder:text-slate-400"
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Limpiar búsqueda"
            className="flex-none text-slate-400 transition-colors hover:text-navy-900"
          >
            <X className="h-4 w-4" strokeWidth={1.6} />
          </button>
        )}
      </div>
    </section>
  );
}
