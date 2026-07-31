import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** `soft` es la acción por defecto del sistema: caja con relleno tenue que al
 *  hover invierte a navy. `solid` nace ya invertido y se reserva para el CTA
 *  primario de una pantalla (pagar, confirmar) — la jerarquía entre ambos es el
 *  contraste en reposo, no la forma. */
type ButtonVariant = "soft" | "solid" | "outline" | "ghost";
type ButtonSize = "default" | "sm" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  soft: "bg-surface text-navy-900 font-bold tracking-[.16em] uppercase hover:bg-navy-900 hover:text-canvas disabled:bg-surface disabled:text-disabled",
  solid:
    "bg-navy-900 text-canvas font-bold tracking-[.16em] uppercase hover:bg-navy-700 disabled:bg-disabled",
  outline:
    "border border-line text-navy-900 tracking-[.16em] uppercase font-medium hover:border-navy-900",
  ghost:
    "text-slate-400 tracking-[.16em] uppercase font-medium hover:text-navy-900",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "text-[10.5px]",
  default: "text-[11.5px]",
  lg: "text-[12.5px]",
};

/** Solo las variantes con caja llevan padding: `ghost` es texto puro y un
 *  padding lo despegaría de la línea base de su fila. */
const BOX_PADDING: Record<ButtonSize, string> = {
  sm: "px-3 py-2",
  default: "px-5 py-3",
  lg: "px-7 py-4",
};

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none";

function buttonClasses(
  variant: ButtonVariant = "soft",
  size: ButtonSize = "default",
  className?: string
) {
  const hasBox = variant !== "ghost";
  return cn(BASE, VARIANTS[variant], SIZES[size], hasBox && BOX_PADDING[size], className);
}

interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

function Button({
  className,
  variant = "soft",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}

interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Un CTA que navega es un enlace, no un botón. Existe para no anidar un
 *  <button> dentro de un <a> —HTML inválido— solo por heredar el estilo. */
function ButtonLink({
  className,
  variant = "soft",
  size = "default",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      data-slot="button-link"
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}

export { Button, ButtonLink, type ButtonVariant, type ButtonSize };
