import * as React from "react";
import { Clock, Check, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OperationStatus } from "@/generated/prisma";

const CONFIG: Record<OperationStatus, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  pending:   { label: "Pendiente",   icon: Clock, tone: "text-[var(--ops-warning)] bg-[var(--ops-warning)]/10 ring-[var(--ops-warning)]/25" },
  confirmed: { label: "Confirmada",  icon: Check, tone: "text-[var(--ops-success)] bg-[var(--ops-success)]/10 ring-[var(--ops-success)]/25" },
  cancelled: { label: "Cancelada",   icon: Ban,   tone: "text-muted-foreground bg-muted/30 ring-border" },
};

type Props = { status: OperationStatus; size?: "sm" | "md"; className?: string };

export function OpStatusPill({ status, size = "sm", className }: Props) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;
  const sizing = size === "sm" ? "px-1.5 py-0.5 text-[10.5px] gap-1" : "px-2 py-1 text-xs gap-1.5";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium ring-1 ring-inset whitespace-nowrap",
        cfg.tone,
        sizing,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}
