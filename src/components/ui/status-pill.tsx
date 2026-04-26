import * as React from "react";
import { cn } from "@/lib/utils";

export type OpsStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "delayed"
  | "paid"
  | "pending"
  | "available"
  | "maintenance"
  | "active"
  | "inactive";

const STATUS_TONE: Record<
  OpsStatus,
  { label: string; tone: "active" | "warning" | "success" | "critical" | "idle" | "track"; pulse: boolean }
> = {
  scheduled:   { label: "Programado",   tone: "idle",     pulse: false },
  in_progress: { label: "En curso",     tone: "active",   pulse: true  },
  completed:   { label: "Completado",   tone: "success",  pulse: false },
  cancelled:   { label: "Cancelado",    tone: "critical", pulse: false },
  delayed:     { label: "Con retraso",  tone: "warning",  pulse: true  },
  paid:        { label: "Pagado",       tone: "success",  pulse: false },
  pending:     { label: "Pendiente",    tone: "warning",  pulse: false },
  available:   { label: "Disponible",   tone: "success",  pulse: false },
  maintenance: { label: "Mantenimiento",tone: "warning",  pulse: false },
  active:      { label: "Activo",       tone: "active",   pulse: false },
  inactive:    { label: "Inactivo",     tone: "idle",     pulse: false },
};

const TONE_STYLES: Record<string, string> = {
  active:   "bg-[var(--ops-active)]/10 text-[var(--ops-active)] ring-[var(--ops-active)]/25",
  warning:  "bg-[var(--ops-warning)]/12 text-[var(--ops-warning)] ring-[var(--ops-warning)]/30",
  success:  "bg-[var(--ops-success)]/10 text-[var(--ops-success)] ring-[var(--ops-success)]/25",
  critical: "bg-[var(--ops-critical)]/10 text-[var(--ops-critical)] ring-[var(--ops-critical)]/25",
  idle:     "bg-[var(--ops-idle)]/12 text-[var(--ops-idle)] ring-[var(--ops-idle)]/25",
  track:    "bg-[var(--ops-track)]/12 text-[var(--ops-track)] ring-[var(--ops-track)]/25",
};

const DOT_TONE: Record<string, string> = {
  active:   "status-dot--active",
  warning:  "status-dot--warning",
  success:  "status-dot--success",
  critical: "status-dot--critical",
  idle:     "status-dot--idle",
  track:    "status-dot--track",
};

const PULSE_TONE: Record<string, string> = {
  active:   "status-pulse--active",
  warning:  "status-pulse--warning",
  critical: "status-pulse--critical",
  success:  "",
  idle:     "",
  track:    "",
};

type StatusPillProps = {
  status: OpsStatus;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
};

export function StatusPill({ status, size = "md", label, className }: StatusPillProps) {
  const cfg = STATUS_TONE[status];
  const tone = cfg.tone;
  const sizing =
    size === "sm" ? "px-2 py-0.5 text-[10.5px] gap-1.5"
    : size === "lg" ? "px-3 py-1.5 text-sm gap-2"
    : "px-2.5 py-1 text-xs gap-1.5";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium ring-1 ring-inset whitespace-nowrap w-fit",
        TONE_STYLES[tone],
        sizing,
        className
      )}
    >
      <span
        className={cn("status-dot", DOT_TONE[tone], cfg.pulse && PULSE_TONE[tone])}
        aria-hidden
      />
      {label ?? cfg.label}
    </span>
  );
}
