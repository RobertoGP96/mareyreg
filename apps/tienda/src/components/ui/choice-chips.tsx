"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Estilos base de un chip, compartidos con los chips multi-selección (piezas). */
export const CHIP_BASE =
  "tabular flex min-h-10 flex-none snap-start items-center border px-4 text-[12px] motion-safe:transition-colors motion-safe:duration-150";
export const CHIP_ON = "border-navy-900 font-bold text-navy-900";
export const CHIP_OFF =
  "border-line text-slate-500 hover:border-navy-900 hover:text-navy-900";
export const CHIP_DISABLED =
  "cursor-not-allowed border-line-soft text-disabled line-through";

export interface ChoiceChipOption {
  value: string;
  label: React.ReactNode;
  /** Opción agotada: se muestra tachada y no se puede elegir, pero no se oculta. */
  disabled?: boolean;
}

interface ChoiceChipsProps {
  options: ChoiceChipOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** id del rótulo del grupo (eyebrow) para aria-labelledby. */
  labelledBy: string;
  className?: string;
}

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

/**
 * Fila de chips con scroll horizontal que se comporta como un radiogroup:
 * un solo tab stop (roving tabindex), flechas/Home/End mueven la selección
 * saltando las opciones agotadas.
 */
function ChoiceChips({
  options,
  value,
  onChange,
  labelledBy,
  className,
}: ChoiceChipsProps) {
  const buttonsRef = React.useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = options.findIndex((o) => o.value === value);
  // Si la seleccionada no existe, el tab stop cae en la primera disponible.
  const tabStopIndex =
    selectedIndex >= 0
      ? selectedIndex
      : Math.max(
          0,
          options.findIndex((o) => !o.disabled)
        );

  // Re-elegir la opción activa no avisa: el padre podría reiniciar estado
  // dependiente (formato, cantidad) sin que nada haya cambiado.
  const select = (option: ChoiceChipOption) => {
    if (option.disabled || option.value === value) return;
    onChange(option.value);
  };

  const moveTo = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    select(option);
    buttonsRef.current[index]?.focus();
  };

  const step = (from: number, dir: 1 | -1) => {
    const count = options.length;
    for (let i = 1; i <= count; i++) {
      const idx = (from + dir * i + count) % count;
      if (!options[idx].disabled) return moveTo(idx);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (NEXT_KEYS.has(e.key)) {
      e.preventDefault();
      step(index, 1);
    } else if (PREV_KEYS.has(e.key)) {
      e.preventDefault();
      step(index, -1);
    } else if (e.key === "Home") {
      e.preventDefault();
      const first = options.findIndex((o) => !o.disabled);
      if (first >= 0) moveTo(first);
    } else if (e.key === "End") {
      e.preventDefault();
      for (let i = options.length - 1; i >= 0; i--) {
        if (!options[i].disabled) return moveTo(i);
      }
    }
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      // overflow-x recorta el anillo de foco (outline 1px + offset 2px, fuera
      // de la caja del chip): el padding de 4px le da sitio y los márgenes
      // negativos lo compensan para que el layout no cambie.
      className={cn(
        "no-scrollbar -mx-1 -mb-1 flex snap-x gap-2 overflow-x-auto px-1 py-1",
        className
      )}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonsRef.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={option.disabled || undefined}
            tabIndex={index === tabStopIndex ? 0 : -1}
            onClick={() => select(option)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              CHIP_BASE,
              option.disabled ? CHIP_DISABLED : checked ? CHIP_ON : CHIP_OFF
            )}
          >
            {option.label}
            {option.disabled && <span className="sr-only"> agotado</span>}
          </button>
        );
      })}
    </div>
  );
}

export { ChoiceChips };
