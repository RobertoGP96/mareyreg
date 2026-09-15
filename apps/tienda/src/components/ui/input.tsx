import * as React from "react";
import { cn } from "@/lib/utils";

/** `box` es el input del sistema: caja blanca redondeada con borde de 1.5px.
 *  `rule` existe para campos en línea (cupón, buscador de una fila) donde una
 *  caja completa pesaría demasiado: solo un subrayado. */
type InputVariant = "rule" | "box";

// El color de foco lo pone `.field-shell` en globals.css (borde + halo), que
// además se lleva el anillo para que no salga una segunda línea.
const VARIANTS: Record<InputVariant, string> = {
  rule: "rounded-none border-b-[1.5px] border-line bg-transparent py-2.5",
  box: "rounded-md border-[1.5px] border-line bg-canvas px-4 py-3",
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
        "field-shell w-full min-w-0 text-[14px] text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}

export { Input, type InputVariant };
