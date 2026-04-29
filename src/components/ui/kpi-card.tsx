import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spark } from "./spark";

type Accent = "brand" | "success" | "warning" | "info" | "danger" | "slate";
type Size = "compact" | "default" | "hero";

const ACCENT_GRADIENT: Record<Accent, string> = {
  brand:
    "bg-[linear-gradient(135deg,#1e3a8a_0%,#2563eb_50%,#60a5fa_100%)]",
  success: "bg-[linear-gradient(135deg,#059669_0%,#10b981_100%)]",
  warning: "bg-[linear-gradient(135deg,#d97706_0%,#f59e0b_100%)]",
  info: "bg-[linear-gradient(135deg,#0891b2_0%,#06b6d4_100%)]",
  danger: "bg-[linear-gradient(135deg,#dc2626_0%,#ef4444_100%)]",
  slate: "bg-[linear-gradient(135deg,#475569_0%,#64748b_100%)]",
};

const ACCENT_COLOR: Record<Accent, string> = {
  brand: "#2563eb",
  success: "#10b981",
  warning: "#f59e0b",
  info: "#06b6d4",
  danger: "#ef4444",
  slate: "#64748b",
};

const ACCENT_TINT: Record<Accent, string> = {
  brand: "bg-[var(--brand)]/10",
  success: "bg-[var(--success)]/10",
  warning: "bg-[var(--warning)]/10",
  info: "bg-[var(--info)]/10",
  danger: "bg-[var(--destructive)]/10",
  slate: "bg-slate-500/10",
};

type KpiCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** % change vs previous period. Pass negative for decline. */
  delta?: number;
  /** Series for the embedded sparkline. Omit to hide. */
  spark?: number[];
  accent?: Accent;
  /** Tamaño visual. `default` mantiene el look original. */
  size?: Size;
  className?: string;
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  spark,
  accent = "brand",
  size = "default",
  className,
}: KpiCardProps) {
  const isPositive = (delta ?? 0) >= 0;
  const isHero = size === "hero";
  const isCompact = size === "compact";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card",
        isHero
          ? "surface-premium shadow-elevated p-5 md:p-6 h-full flex flex-col"
          : isCompact
            ? "shadow-sm p-3.5"
            : "shadow-sm p-[18px]",
        className
      )}
    >
      {isHero && (
        <>
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full blur-3xl",
              ACCENT_TINT[accent]
            )}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-[var(--brand)]/8 blur-3xl"
          />
        </>
      )}

      <div
        className={cn(
          "relative flex items-start justify-between",
          isHero ? "mb-4" : isCompact ? "mb-2.5" : "mb-3.5"
        )}
      >
        <div
          className={cn(
            "grid place-items-center rounded-md text-white shadow-sm",
            isHero
              ? "size-12 rounded-xl"
              : isCompact
                ? "size-7"
                : "size-9",
            ACCENT_GRADIENT[accent]
          )}
        >
          <Icon
            className={cn(
              isHero ? "size-6" : isCompact ? "size-4" : "size-[18px]"
            )}
            strokeWidth={2}
          />
        </div>

        {delta != null && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
              isHero ? "text-xs" : "text-[10.5px]",
              isPositive
                ? "bg-[var(--success)]/12 text-[var(--success)]"
                : "bg-[var(--destructive)]/12 text-[var(--destructive)]"
            )}
          >
            {isPositive ? (
              <TrendingUp className={isHero ? "size-3.5" : "size-3"} />
            ) : (
              <TrendingDown className={isHero ? "size-3.5" : "size-3"} />
            )}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>

      <div
        className={cn(
          "relative font-medium text-muted-foreground",
          isHero
            ? "text-[11px] uppercase tracking-[0.14em]"
            : isCompact
              ? "text-[11px] tracking-[0.01em]"
              : "text-[12px] tracking-[0.01em]"
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "relative font-headline font-bold leading-tight tracking-[-0.02em] tabular-nums text-foreground",
          isHero
            ? "mt-2 text-[44px] md:text-[56px] tracking-[-0.03em]"
            : isCompact
              ? "text-xl"
              : "text-[28px]"
        )}
      >
        {value}
      </div>

      {spark && spark.length > 0 && (
        <div
          className={cn(
            "relative",
            isHero ? "mt-auto pt-4" : isCompact ? "mt-2" : "mt-2.5"
          )}
        >
          <Spark
            data={spark}
            color={ACCENT_COLOR[accent]}
            height={isHero ? 56 : 32}
          />
        </div>
      )}
    </div>
  );
}
