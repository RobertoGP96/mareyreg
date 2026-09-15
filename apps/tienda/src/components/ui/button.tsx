import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** `soft` es la acción secundaria del sistema: píldora con tinte azul tenue.
 *  `solid` es el CTA primario de una pantalla (pagar, confirmar, añadir) en
 *  navy pleno. `outline` y `ghost` son acciones terciarias. */
type ButtonVariant = "soft" | "solid" | "outline" | "ghost";
type ButtonSize = "default" | "sm" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  soft: "bg-tint text-navy-900 hover:bg-tint-strong disabled:bg-surface disabled:text-disabled",
  solid:
    "bg-navy-700 text-on-brand hover:bg-navy-600 disabled:bg-surface disabled:text-disabled",
  outline:
    "border-[1.5px] border-line bg-transparent text-navy-700 hover:border-tint-strong hover:bg-tint disabled:text-disabled",
  ghost: "text-slate-500 hover:text-navy-700 disabled:text-disabled",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "text-[13px]",
  default: "text-[14px]",
  lg: "text-[15px]",
};

/** Solo las variantes con caja llevan padding: `ghost` es texto puro. */
const BOX_PADDING: Record<ButtonSize, string> = {
  sm: "px-4 py-2",
  default: "px-[22px] py-3",
  lg: "px-[30px] py-3.5",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold leading-[1.2] whitespace-nowrap transition-[background-color,color,border-color,transform] duration-150 motion-safe:active:scale-[.98] disabled:pointer-events-none";

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
