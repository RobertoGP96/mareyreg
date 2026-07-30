import * as React from "react";
import { cn } from "@/lib/utils";

/** `rule` es el input del sistema: sin caja, solo un hairline inferior.
 *  `box` existe para formularios largos (checkout, perfil), donde el borde
 *  completo hace escaneable la columna de campos. */
type InputVariant = "rule" | "box";

const VARIANTS: Record<InputVariant, string> = {
  rule: "border-b border-rule bg-transparent py-2.5 focus:border-navy-900",
  box: "border border-line bg-canvas px-3.5 py-3 focus:border-navy-900",
};

interface InputProps extends React.ComponentProps<"input"> {
  variant?: InputVariant;
}

function Input({ className, type, variant = "box", ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "w-full min-w-0 text-[13.5px] text-ink transition-colors placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}

export { Input, type InputVariant };
