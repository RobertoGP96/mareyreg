import * as React from "react";
import { cn } from "@/lib/utils";
import { formatAmount } from "../../lib/format";

type Props = {
  value: number;
  decimalPlaces?: number;
  showSign?: boolean;
  signed?: boolean; // colorea positivo/negativo
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function AmountDisplay({
  value,
  decimalPlaces = 2,
  showSign = false,
  signed = false,
  size = "md",
  className,
}: Props) {
  const formatted = formatAmount(value, decimalPlaces, { showSign });
  const sizing =
    size === "sm" ? "text-xs"
      : size === "lg" ? "text-2xl md:text-3xl font-bold"
        : "text-sm";
  const colour =
    signed && value > 0 ? "text-[var(--ops-success)]"
      : signed && value < 0 ? "text-[var(--ops-critical,#ef4444)]"
        : "text-foreground";
  return (
    <span className={cn("font-mono tabular-nums", sizing, colour, className)}>
      {formatted}
    </span>
  );
}
