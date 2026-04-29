import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  badge?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
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
}: PageHeaderProps) {
  const actionsContent = actions ?? children;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5 md:p-6 shadow-panel">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[var(--brand)]/8 blur-3xl" />

        <div className="relative flex items-start gap-3 sm:gap-4">
          {Icon && (
            <div className="flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand)]/20 via-[var(--brand)]/10 to-transparent ring-1 ring-inset ring-[var(--brand)]/20">
              <Icon className="h-5 w-5 text-[var(--brand)]" strokeWidth={2.2} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {badge && (
              <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--brand)] ring-1 ring-inset ring-[var(--brand)]/20">
                {badge}
              </span>
            )}
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold font-headline tracking-tight text-foreground leading-tight break-words">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed break-words">
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
