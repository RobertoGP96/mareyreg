"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAmount } from "../../lib/format";
import type { ActiveDenomination } from "../../queries/currency-denomination-queries";

export type BreakdownEntry = { denominationId: number; quantity: number };

interface Props {
  denominations: ActiveDenomination[];
  value: BreakdownEntry[];
  onChange: (next: BreakdownEntry[]) => void;
  currencyCode: string;
  currencyDecimals: number;
}

export function computeBreakdownTotal(
  entries: BreakdownEntry[],
  denominations: ActiveDenomination[],
  decimals: number
): number {
  const valueById = new Map(denominations.map((d) => [d.denominationId, Number(d.value)]));
  const raw = entries.reduce(
    (sum, e) => sum + (valueById.get(e.denominationId) ?? 0) * e.quantity,
    0
  );
  const factor = 10 ** decimals;
  return Math.round((raw + Number.EPSILON) * factor) / factor;
}

/**
 * Captura de billetes de una línea. El monto de la línea sale de aquí: no hay
 * campo de monto que teclear, así que no existe la posibilidad de descuadre.
 */
export function DenominationBreakdownEditor({
  denominations,
  value,
  onChange,
  currencyCode,
  currencyDecimals,
}: Props) {
  const quantityById = useMemo(
    () => new Map(value.map((e) => [e.denominationId, e.quantity])),
    [value]
  );

  const total = useMemo(
    () => computeBreakdownTotal(value, denominations, currencyDecimals),
    [value, denominations, currencyDecimals]
  );

  const setQuantity = (denominationId: number, quantity: number) => {
    const safe = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
    const rest = value.filter((e) => e.denominationId !== denominationId);
    onChange(safe > 0 ? [...rest, { denominationId, quantity: safe }] : rest);
  };

  if (denominations.length === 0) {
    return (
      <p className="text-xs text-destructive">
        {currencyCode} no tiene denominaciones configuradas. Agrégalas en Monedas antes de
        registrar entregas en esta divisa.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {denominations.map((d) => {
          const qty = quantityById.get(d.denominationId) ?? 0;
          return (
            <div
              key={d.denominationId}
              className={cn(
                "rounded-lg border p-2 space-y-1.5",
                qty > 0 ? "border-[var(--brand)] bg-[var(--brand)]/5" : "border-border"
              )}
            >
              <span className="block text-xs font-mono tabular-nums font-medium">
                {d.label ?? formatAmount(Number(d.value), currencyDecimals)}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label={`Quitar un billete de ${d.value}`}
                  disabled={qty === 0}
                  onClick={() => setQuantity(d.denominationId, qty - 1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={qty === 0 ? "" : String(qty)}
                  placeholder="0"
                  aria-label={`Cantidad de billetes de ${d.value}`}
                  onChange={(e) => setQuantity(d.denominationId, Number(e.target.value))}
                  className="h-7 px-1 text-center font-mono tabular-nums"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label={`Agregar un billete de ${d.value}`}
                  onClick={() => setQuantity(d.denominationId, qty + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
        <span className="text-xs text-muted-foreground">Total desglosado</span>
        <span className="font-mono tabular-nums font-medium">
          {formatAmount(total, currencyDecimals)} {currencyCode}
        </span>
      </div>
    </div>
  );
}
