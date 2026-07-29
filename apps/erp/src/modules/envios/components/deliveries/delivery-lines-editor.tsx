"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { formatAmount } from "../../lib/format";
import type { CurrencyRow } from "../../lib/types";
import type { ActiveDenomination } from "../../queries/currency-denomination-queries";
import {
  DenominationBreakdownEditor,
  computeBreakdownTotal,
  type BreakdownEntry,
} from "./denomination-breakdown-editor";

export type DeliveryLineDraft = {
  currencyId: number;
  /** Solo monedas de efectivo. En digital queda vacío. */
  breakdown: BreakdownEntry[];
  /** Solo monedas digitales. En efectivo el monto se deriva del desglose. */
  amount: string;
};

interface Props {
  lines: DeliveryLineDraft[];
  onChange: (next: DeliveryLineDraft[]) => void;
  currencies: CurrencyRow[];
  denominationsByCurrency: Record<number, ActiveDenomination[]>;
}

export function lineAmount(
  line: DeliveryLineDraft,
  currencies: CurrencyRow[],
  denominationsByCurrency: Record<number, ActiveDenomination[]>
): number {
  const currency = currencies.find((c) => c.currencyId === line.currencyId);
  const decimals = currency?.decimalPlaces ?? 2;
  if (currency?.kind === "digital") {
    const raw = Number(line.amount);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    const factor = 10 ** decimals;
    return Math.round((raw + Number.EPSILON) * factor) / factor;
  }
  return computeBreakdownTotal(
    line.breakdown,
    denominationsByCurrency[line.currencyId] ?? [],
    decimals
  );
}

export function DeliveryLinesEditor({
  lines,
  onChange,
  currencies,
  denominationsByCurrency,
}: Props) {
  const usedCurrencyIds = new Set(lines.map((l) => l.currencyId));
  const available = currencies.filter((c) => c.active && !usedCurrencyIds.has(c.currencyId));

  const updateLine = (index: number, patch: Partial<DeliveryLineDraft>) => {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const addLine = () => {
    const next = available[0];
    if (!next) return;
    onChange([...lines, { currencyId: next.currencyId, breakdown: [], amount: "" }]);
  };

  return (
    <div className="space-y-3">
      {lines.map((line, index) => {
        const currency = currencies.find((c) => c.currencyId === line.currencyId);
        const decimals = currency?.decimalPlaces ?? 2;
        const isDigital = currency?.kind === "digital";
        const amount = lineAmount(line, currencies, denominationsByCurrency);
        // Al cambiar de moneda el desglose deja de ser válido: las
        // denominaciones pertenecen a la moneda anterior.
        const changeCurrency = (v: string) =>
          updateLine(index, { currencyId: Number(v), breakdown: [], amount: "" });

        return (
          <div key={index} className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Select value={String(line.currencyId)} onValueChange={changeCurrency}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Moneda" />
                </SelectTrigger>
                <SelectContent>
                  {currencies
                    .filter((c) => c.active && (c.currencyId === line.currencyId || !usedCurrencyIds.has(c.currencyId)))
                    .map((c) => (
                      <SelectItem key={c.currencyId} value={String(c.currencyId)}>
                        {c.code} · {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {isDigital ? (
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  aria-label={`Monto en ${currency?.code ?? ""}`}
                  value={line.amount}
                  onChange={(e) => updateLine(index, { amount: e.target.value })}
                  className="flex-1 text-right font-mono tabular-nums"
                />
              ) : (
                <span className="flex-1 text-right font-mono tabular-nums font-medium">
                  {formatAmount(amount, decimals)}
                </span>
              )}

              {lines.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 text-destructive shrink-0"
                  aria-label="Quitar este monto"
                  onClick={() => onChange(lines.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {isDigital ? (
              <p className="text-xs text-muted-foreground">
                {currency?.code} es una moneda digital: se captura el monto directo, sin
                desglose de billetes.
              </p>
            ) : (
              <DenominationBreakdownEditor
                denominations={denominationsByCurrency[line.currencyId] ?? []}
                value={line.breakdown}
                onChange={(breakdown) => updateLine(index, { breakdown })}
                currencyCode={currency?.code ?? ""}
                currencyDecimals={decimals}
              />
            )}
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addLine}
        disabled={available.length === 0}
        className="w-full"
      >
        <Plus className="h-4 w-4" /> Agregar otra moneda
      </Button>
    </div>
  );
}
