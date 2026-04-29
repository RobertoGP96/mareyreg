import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  /** Etiqueta corta sobre el título, en mayúsculas. Ej: "Tesorería". */
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Color tonal del icono y del eyebrow. Por defecto brand. */
  tone?: "brand" | "ops-active" | "ops-warning" | "ops-success" | "muted";
  actions?: React.ReactNode;
  className?: string;
  /** Render del divider gradient bajo el bloque. */
  divider?: boolean;
  /** Nivel del heading (a11y). */
  as?: "h2" | "h3";
};

const TONE_FG: Record<NonNullable<SectionHeadingProps["tone"]>, string> = {
  brand: "text-[var(--brand)]",
  "ops-active": "text-[var(--ops-active)]",
  "ops-warning": "text-[var(--ops-warning)]",
  "ops-success": "text-[var(--ops-success)]",
  muted: "text-muted-foreground",
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  icon: Icon,
  tone = "brand",
  actions,
  className,
  divider = true,
  as = "h2",
}: SectionHeadingProps) {
  const Heading = as;
  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div
              className={cn(
                "mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em]",
                TONE_FG[tone]
              )}
            >
              {Icon && <Icon className="h-3 w-3" strokeWidth={2.4} />}
              <span>{eyebrow}</span>
            </div>
          )}
          <Heading className="font-headline text-xl md:text-2xl font-semibold tracking-tight text-foreground leading-tight">
            {title}
          </Heading>
          {description && (
            <p className="mt-1 text-xs md:text-sm text-muted-foreground max-w-xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2 pb-1">{actions}</div>
        )}
      </div>
      {divider && (
        <div className="h-px bg-gradient-to-r from-border via-border/70 to-transparent" />
      )}
    </div>
  );
}
