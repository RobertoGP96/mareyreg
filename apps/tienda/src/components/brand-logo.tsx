import Link from "next/link";
import { Store } from "lucide-react";
import { STORE_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  /** `inverse` para fondos navy (footer): la palabra pasa a blanco. */
  tone?: "default" | "inverse";
  size?: "sm" | "md";
  /** Sin enlace en lugares donde ya se está en la home o dentro de otro <a>. */
  asLink?: boolean;
  className?: string;
}

/** Lockup de marca: tesela azul con el icono de tienda en azul claro y la
 *  palabra al lado. Los colores de la tesela son fijos en ambos temas: son la
 *  identidad, no un token semántico. */
export function BrandLogo({
  tone = "default",
  size = "md",
  asLink = true,
  className,
}: BrandLogoProps) {
  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex flex-none items-center justify-center bg-brand-tile text-brand-tile-fg shadow-card",
          size === "sm" ? "h-8 w-8 rounded-[9px]" : "h-9 w-9 rounded-[10px]",
          tone === "inverse" && "ring-1 ring-white/15"
        )}
      >
        <Store
          className={size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]"}
          strokeWidth={2}
        />
      </span>
      <span
        className={cn(
          "font-display leading-none tracking-[.06em]",
          size === "sm" ? "text-[17px]" : "text-[20px]",
          tone === "inverse" ? "text-white" : "text-navy-700"
        )}
      >
        {STORE_NAME}
      </span>
    </>
  );

  const rootClass = cn("inline-flex flex-none items-center gap-2.5", className);

  if (!asLink) {
    return <span className={rootClass}>{content}</span>;
  }

  return (
    <Link
      href="/"
      aria-label={`${STORE_NAME}, ir al inicio`}
      className={cn(rootClass, "transition-opacity duration-150 hover:opacity-85")}
    >
      {content}
    </Link>
  );
}
