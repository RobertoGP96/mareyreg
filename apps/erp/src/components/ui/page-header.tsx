import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "default" | "editorial";

type PageHeaderProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  badge?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** `editorial` aplica mesh-bg + display title más grande + gradient text. */
  variant?: Variant;
  /**
   * Subcadena del `title` que se resalta con `text-gradient-brand`.
   * Solo aplica cuando `variant="editorial"`. Debe estar literal en `title`.
   */
  accentTitle?: string;
};

/**
 * Premium page header. El card contiene icono, título, descripción y meta
 * (badges/pills informativos). Los botones de acción se renderizan FUERA
 * del card, apilados verticalmente en mobile y en fila a la derecha desde
 * `sm:`.
 *
 * `children` se mantiene como alias backward-compatible de `actions`.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  badge,
  meta,
  actions,
  children,
  className,
  variant = "default",
  accentTitle,
}: PageHeaderProps) {
  const actionsContent = actions ?? children;
  const isEditorial = variant === "editorial";

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border bg-card",
          isEditorial
            ? "p-5 sm:p-6 md:p-7 shadow-elevated"
            : "p-4 sm:p-5 md:p-6 shadow-panel"
        )}
      >
        {isEditorial && (
          <>
            <div className="pointer-events-none absolute inset-0 mesh-bg opacity-70" />
            <div className="pointer-events-none absolute inset-0 grid-pattern opacity-[0.28]" />
            <div className="pointer-events-none absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-[var(--brand)]/12 via-transparent to-transparent" />
          </>
        )}
        {!isEditorial && (
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[var(--brand)]/8 blur-3xl" />
        )}

        <div className="relative flex items-start gap-3 sm:gap-4">
          {Icon && (
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand)]/20 via-[var(--brand)]/10 to-transparent ring-1 ring-inset ring-[var(--brand)]/20",
                isEditorial ? "size-12 sm:size-14" : "size-10 sm:size-11"
              )}
            >
              <Icon
                className={cn(
                  "text-[var(--brand)]",
                  isEditorial ? "h-6 w-6 sm:h-7 sm:w-7" : "h-5 w-5"
                )}
                strokeWidth={2.2}
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {badge && (
              <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--brand)] ring-1 ring-inset ring-[var(--brand)]/20">
                {badge}
              </span>
            )}
            <h1
              className={cn(
                "font-bold font-headline tracking-tight text-foreground leading-[1.05] break-words",
                isEditorial
                  ? "text-2xl sm:text-3xl md:text-4xl tracking-[-0.02em]"
                  : "text-lg sm:text-xl md:text-2xl"
              )}
            >
              {isEditorial && accentTitle ? (
                <RenderAccentedTitle title={title} accent={accentTitle} />
              ) : (
                title
              )}
            </h1>
            {description && (
              <p
                className={cn(
                  "text-muted-foreground mt-1.5 max-w-xl leading-relaxed break-words",
                  isEditorial ? "text-sm md:text-base" : "text-sm"
                )}
              >
                {description}
              </p>
            )}
            {meta && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {meta}
              </div>
            )}
          </div>
        </div>
      </div>

      {actionsContent && (
        <div
          className={cn(
            "flex flex-col gap-2",
            "sm:flex-row sm:flex-wrap sm:items-center sm:justify-end",
            "[&>button]:w-full [&>a]:w-full",
            "sm:[&>button]:w-auto sm:[&>a]:w-auto"
          )}
        >
          {actionsContent}
        </div>
      )}
    </div>
  );
}

function RenderAccentedTitle({
  title,
  accent,
}: {
  title: string;
  accent: string;
}) {
  const idx = title.indexOf(accent);
  if (idx === -1) return <>{title}</>;
  const before = title.slice(0, idx);
  const after = title.slice(idx + accent.length);
  return (
    <>
      {before}
      <span className="text-gradient-brand">{accent}</span>
      {after}
    </>
  );
}
