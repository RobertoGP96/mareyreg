"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  /** Muestra el rótulo junto al icono (header desktop); en móvil solo el icono. */
  showLabel?: boolean;
  className?: string;
}

export function ThemeToggle({ showLabel = false, className }: ThemeToggleProps) {
  const { toggleTheme } = useTheme();

  // Icono y rótulo se resuelven por CSS y no por estado: el tema real lo fija un
  // script antes de hidratar, así que leerlo en el primer render mostraría el
  // icono equivocado durante un frame.
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Cambiar entre tema claro y oscuro"
      className={cn(
        "nav-label inline-flex items-center gap-1.5 text-slate-400 transition-colors duration-150 hover:text-navy-900",
        className
      )}
    >
      <Sun className="h-4 w-4 dark:hidden" strokeWidth={1.6} />
      <Moon className="hidden h-4 w-4 dark:block" strokeWidth={1.6} />
      {showLabel && (
        <>
          <span className="dark:hidden">Claro</span>
          <span className="hidden dark:inline">Oscuro</span>
        </>
      )}
    </button>
  );
}
