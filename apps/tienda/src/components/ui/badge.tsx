import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "featured" | "discount" | "soldout" | "neutral";

const VARIANTS: Record<BadgeVariant, string> = {
  featured: "grad-cta text-white",
  discount: "bg-brand text-white",
  soldout: "bg-[#6B7A94] text-white",
  neutral: "bg-chip text-brand",
};

interface BadgeProps extends React.ComponentProps<"span"> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[10px] font-semibold",
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge, type BadgeVariant };
