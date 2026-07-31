"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Popover, PopoverPanel } from "@/components/ui/popover";

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
  const [open, setOpen] = useState(autoFocus);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <section className="border-b border-line px-5 pt-[58px] pb-[46px] text-center md:px-10">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="font-display mt-5 text-[42px] leading-none text-navy-900 md:text-[66px]">
        {title}
      </h1>
      <p className="mx-auto mt-5 max-w-[470px] text-[14px] leading-[1.65] text-pretty text-slate-500">
        {description}
      </p>

      <div className="mt-9 flex items-center justify-center gap-2">
        <Popover open={open} onClose={() => setOpen(false)}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Buscar en el catálogo"
            className="inline-flex max-w-[min(78vw,360px)] items-center gap-3 border border-line bg-surface px-5 py-3 text-[13px] transition-colors duration-150 hover:border-navy-900 aria-expanded:border-navy-900"
          >
            <Search
              className="h-4 w-4 flex-none text-slate-400"
              strokeWidth={1.6}
            />
            <span
              className={`truncate ${value ? "font-semibold text-navy-900" : "text-slate-400"}`}
            >
              {value || "Buscar en el catálogo"}
            </span>
          </button>

          {open && (
            <PopoverPanel align="center" className="w-[min(88vw,420px)] p-4">
              <div className="flex items-center gap-3 border border-line bg-surface px-4 py-2.5 transition-colors focus-within:border-navy-900">
                <Search
                  className="h-4 w-4 flex-none text-slate-400"
                  strokeWidth={1.6}
                />
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") setOpen(false);
                  }}
                  placeholder="Nombre o categoría"
                  aria-label="Buscar en el catálogo"
                  autoComplete="off"
                  className="w-full bg-transparent text-left text-[14px] text-ink placeholder:text-slate-400"
                />
              </div>
              <p className="mt-3 text-left text-[12px] text-slate-400">
                El catálogo se filtra mientras escribes.
              </p>
            </PopoverPanel>
          )}
        </Popover>

        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Limpiar búsqueda"
            className="inline-flex h-[42px] w-[42px] flex-none items-center justify-center border border-line text-slate-400 transition-colors duration-150 hover:border-alert hover:text-alert"
          >
            <X className="h-4 w-4" strokeWidth={1.6} />
          </button>
        )}
      </div>
    </section>
  );
}
