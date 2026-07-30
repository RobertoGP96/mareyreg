import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** `link` es la acción por defecto del sistema (texto + hairline inferior).
 *  `solid` es la única excepción con relleno y se reserva para el CTA primario
 *  de una pantalla (pagar, confirmar); nunca dentro de la retícula del catálogo. */
type ButtonVariant = "link" | "solid" | "outline" | "ghost";
type ButtonSize = "default" | "sm" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  link: "border-b border-navy-900 pb-1 font-bold tracking-[.16em] uppercase text-navy-900 hover:text-navy-700 hover:border-navy-700 disabled:border-disabled disabled:text-disabled",
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

/** Solo las variantes con caja llevan padding: `link`/`ghost` son texto puro y
 *  un padding las despegaría de la línea base de su fila. */
const BOX_PADDING: Record<ButtonSize, string> = {
  sm: "px-3 py-2",
  default: "px-5 py-3",
  lg: "px-7 py-4",
};

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none";

function buttonClasses(
  variant: ButtonVariant = "link",
  size: ButtonSize = "default",
  className?: string
) {
  const hasBox = variant === "solid" || variant === "outline";
  return cn(BASE, VARIANTS[variant], SIZES[size], hasBox && BOX_PADDING[size], className);
}

interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

function Button({
  className,
  variant = "link",
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
  variant = "link",
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
