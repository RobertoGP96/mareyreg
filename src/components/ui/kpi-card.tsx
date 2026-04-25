import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spark } from "./spark";

type Accent = "brand" | "success" | "warning" | "info" | "danger" | "slate";

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

type KpiCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** % change vs previous period. Pass negative for decline. */
  delta?: number;
  /** Series for the embedded sparkline. Omit to hide. */
  spark?: number[];
  accent?: Accent;
  className?: string;
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  spark,
  accent = "brand",
  className,
}: KpiCardProps) {
  const isPositive = (delta ?? 0) >= 0;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-[18px] shadow-sm",
        className
      )}
    >
      <div className="mb-3.5 flex items-start justify-between">
        <div
          className={cn(
            "grid size-9 place-items-center rounded-md text-white shadow-sm",
            ACCENT_GRADIENT[accent]
          )}
        >
          <Icon className="size-[18px]" strokeWidth={2} />
        </div>

        {delta != null && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
              isPositive
                ? "bg-[var(--success)]/12 text-[var(--success)]"
                : "bg-[var(--destructive)]/12 text-[var(--destructive)]"
            )}
          >
            {isPositive ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>

      <div className="text-[12px] font-medium tracking-[0.01em] text-muted-foreground">
        {label}
      </div>
      <div className="font-headline text-[28px] font-bold leading-tight tracking-[-0.02em] tabular-nums text-foreground">
        {value}
      </div>

      {spark && spark.length > 0 && (
        <div className="mt-2.5">
          <Spark data={spark} color={ACCENT_COLOR[accent]} height={32} />
        </div>
      )}
    </div>
  );
}
