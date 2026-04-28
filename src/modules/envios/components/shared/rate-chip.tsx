import { ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  rate: number;
  counterAmount?: number | null;
  counterCurrencyCode?: string | null;
  counterCurrencyDecimals?: number | null;
  ruleName?: string | null;
  className?: string;
};

export function RateChip({
  rate,
  counterAmount,
  counterCurrencyCode,
  counterCurrencyDecimals,
  ruleName,
  className,
}: Props) {
  const formattedRate = rate.toLocaleString("es-MX", { maximumFractionDigits: 6 });
  const counter =
    counterAmount != null && counterCurrencyCode
      ? `${counterAmount.toLocaleString("es-MX", {
          minimumFractionDigits: counterCurrencyDecimals ?? 2,
          maximumFractionDigits: counterCurrencyDecimals ?? 2,
        })} ${counterCurrencyCode}`
      : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-[var(--ops-active)]/8 px-1.5 py-0.5 text-[10px] font-medium text-[var(--ops-active)] ring-1 ring-inset ring-[var(--ops-active)]/20 whitespace-nowrap",
        className
      )}
      title={ruleName ?? undefined}
    >
      <ArrowRightLeft className="h-2.5 w-2.5" />
      <span className="font-mono tabular-nums">{formattedRate}</span>
      {counter && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono tabular-nums">{counter}</span>
        </>
      )}
    </span>
  );
}
