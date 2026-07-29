import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OperationType } from "@/generated/prisma";

const CONFIG: Record<OperationType, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  deposit:       { label: "Depósito",       icon: ArrowDownLeft,  tone: "text-[var(--ops-success)] bg-[var(--ops-success)]/10 ring-[var(--ops-success)]/25" },
  withdrawal:    { label: "Retiro",         icon: ArrowUpRight,   tone: "text-rose-600 dark:text-rose-400 bg-rose-500/10 ring-rose-500/25" },
  transfer_in:   { label: "Transf. entrada",icon: ArrowRightLeft, tone: "text-[var(--ops-active)] bg-[var(--ops-active)]/10 ring-[var(--ops-active)]/25" },
  transfer_out:  { label: "Transf. salida", icon: ArrowRightLeft, tone: "text-[var(--ops-active)] bg-[var(--ops-active)]/10 ring-[var(--ops-active)]/25" },
  adjustment:    { label: "Ajuste",         icon: Settings2,      tone: "text-muted-foreground bg-muted/30 ring-border" },
};

type Props = { type: OperationType; size?: "sm" | "md"; className?: string };

export function OpTypeBadge({ type, size = "sm", className }: Props) {
  const cfg = CONFIG[type];
  const Icon = cfg.icon;
  const sizing = size === "sm" ? "px-1.5 py-0.5 text-[10.5px]" : "px-2 py-1 text-xs";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset whitespace-nowrap",
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
