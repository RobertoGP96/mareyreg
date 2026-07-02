import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  value?: React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
};

export function MobileListCard({
  title,
  subtitle,
  meta,
  value,
  actions,
  onClick,
  selected,
  className,
}: Props) {
  const interactive = !!onClick;

  // div[role=button] en vez de <button>: el slot de actions suele traer
  // botones reales (DropdownMenuTrigger) y un button anidado es HTML
  // inválido que rompe la hidratación.
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={
        onClick
          ? (e: React.MouseEvent<HTMLElement>) => {
              const t = e.target as HTMLElement;
              const interactive = t.closest(
                'button, a, input, select, textarea, label, [role="menu"], [role="menuitem"], [role="dialog"], [data-no-row-click]'
              );
              if (interactive && interactive !== e.currentTarget) {
                return;
              }
              onClick();
            }
          : undefined
      }
      onKeyDown={
        onClick
          ? (e: React.KeyboardEvent<HTMLElement>) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              if (e.target !== e.currentTarget) return;
              e.preventDefault();
              onClick();
            }
          : undefined
      }
      className={cn(
        "group relative flex w-full min-h-[64px] flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-left shadow-xs transition-colors",
        interactive &&
          "cursor-pointer hover:border-[var(--brand)]/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        selected && "border-[var(--brand)]/60 bg-[var(--brand)]/5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-foreground leading-tight truncate">
            {title}
          </div>
          {subtitle && (
            <div className="mt-0.5 text-xs text-muted-foreground leading-snug truncate">
              {subtitle}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {value && (
            <div className="text-right text-sm font-semibold tabular-nums text-foreground">
              {value}
            </div>
          )}
          {actions && (
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>
      {meta && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">{meta}</div>
      )}
    </div>
  );
}
