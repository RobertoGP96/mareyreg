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
  /** Cuando true, muestra precisión completa (8 decimales) en hover via title HTML. */
  showFullPrecision?: boolean;
};

export function AmountDisplay({
  value,
  decimalPlaces = 2,
  showSign = false,
  signed = false,
  size = "md",
  className,
  showFullPrecision = true,
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
  // Precisión completa: hasta 8 decimales sin agrupación de miles para inspección.
  const fullPrecision = showFullPrecision
    ? value.toLocaleString("es-MX", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: 8,
        useGrouping: false,
      })
    : undefined;
  return (
    <span
      className={cn("font-mono tabular-nums", sizing, colour, className)}
      title={fullPrecision}
    >
      {formatted}
    </span>
  );
}
