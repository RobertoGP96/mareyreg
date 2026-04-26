import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "active" | "warning" | "success" | "critical" | "idle" | "track";

const TONE: Record<Tone, { bg: string; fg: string }> = {
  active:   { bg: "bg-[var(--ops-active)]/10",   fg: "text-[var(--ops-active)]" },
  warning:  { bg: "bg-[var(--ops-warning)]/12",  fg: "text-[var(--ops-warning)]" },
  success:  { bg: "bg-[var(--ops-success)]/10",  fg: "text-[var(--ops-success)]" },
  critical: { bg: "bg-[var(--ops-critical)]/10", fg: "text-[var(--ops-critical)]" },
  idle:     { bg: "bg-[var(--ops-idle)]/12",     fg: "text-[var(--ops-idle)]" },
  track:    { bg: "bg-[var(--ops-track)]/12",    fg: "text-[var(--ops-track)]" },
};

type MetricTileProps = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: string;
  className?: string;
  active?: boolean;
  onClick?: () => void;
};

export function MetricTile({
  label,
  value,
  icon: Icon,
  tone = "idle",
  hint,
  className,
  active,
  onClick,
}: MetricTileProps) {
  const t = TONE[tone];
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors",
        onClick && "cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active && "ring-2 ring-[var(--ops-active)]/30 border-[var(--ops-active)]/30",
        className
      )}
    >
      {Icon && (
        <span className={cn("grid size-8 place-items-center rounded-md shrink-0", t.bg, t.fg)}>
          <Icon className="size-4" strokeWidth={2} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </div>
        <div className={cn("font-headline text-lg font-bold tabular-nums leading-none mt-0.5", t.fg)}>
          {value}
        </div>
        {hint && <div className="text-[10.5px] text-muted-foreground mt-0.5 truncate">{hint}</div>}
      </div>
    </Comp>
  );
}
