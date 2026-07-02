import * as React from "react";
import { cn } from "@/lib/utils";

const CURRENCY_TONE: Record<string, { fg: string; bg: string; ring: string }> = {
  USD: { fg: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", ring: "ring-sky-500/25" },
  USDT: { fg: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/25" },
  CUP: { fg: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10", ring: "ring-rose-500/25" },
  EUR: { fg: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10", ring: "ring-indigo-500/25" },
  CAN: { fg: "text-pink-600 dark:text-pink-400", bg: "bg-pink-500/10", ring: "ring-pink-500/25" },
};

const DEFAULT_TONE = {
  fg: "text-muted-foreground",
  bg: "bg-muted/30",
  ring: "ring-border",
};

type Props = {
  code: string;
  size?: "sm" | "md";
  className?: string;
};

export function CurrencyChip({ code, size = "sm", className }: Props) {
  const tone = CURRENCY_TONE[code.toUpperCase()] ?? DEFAULT_TONE;
  const sizing = size === "sm" ? "px-1.5 py-0.5 text-[10.5px]" : "px-2 py-1 text-xs";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-mono tabular-nums font-semibold tracking-wide ring-1 ring-inset whitespace-nowrap",
        tone.fg,
        tone.bg,
        tone.ring,
        sizing,
        className
      )}
    >
      {code.toUpperCase()}
    </span>
  );
}
