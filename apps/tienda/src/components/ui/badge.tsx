import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "featured" | "discount" | "soldout" | "neutral";

const VARIANTS: Record<BadgeVariant, string> = {
  featured: "bg-canvas text-navy-900",
  discount: "bg-canvas text-danger",
  // Agotado es el único estado que debe cortar la lectura de la retícula, así
  // que va en relleno sólido y no en texto tenue como el resto de las etiquetas.
  soldout: "bg-alert font-bold text-alert-fg",
  neutral: "border border-line text-slate-500",
};

interface BadgeProps extends React.ComponentProps<"span"> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center gap-1 px-[9px] py-[5px] text-[8.5px] font-semibold tracking-[.22em] uppercase",
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge, type BadgeVariant };
