import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  badge?: string;
  children?: React.ReactNode;
  className?: string;
};

/**
 * Premium page header with optional icon, title, description and actions slot.
 * Use as the first element on every module page for visual consistency.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  badge,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-5 md:p-6 shadow-panel",
        className
      )}
    >
      {/* Corner glow */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[var(--brand)]/8 blur-3xl" />

      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          {Icon && (
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand)]/20 via-[var(--brand)]/10 to-transparent ring-1 ring-inset ring-[var(--brand)]/20">
              <Icon className="h-5 w-5 text-[var(--brand)]" strokeWidth={2.2} />
            </div>
          )}
          <div className="min-w-0">
            {badge && (
              <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--brand)] ring-1 ring-inset ring-[var(--brand)]/20">
                {badge}
              </span>
            )}
            <h1 className="text-xl md:text-2xl font-bold font-headline tracking-tight text-foreground leading-tight">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
        {children && <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>}
      </div>
    </div>
  );
}
