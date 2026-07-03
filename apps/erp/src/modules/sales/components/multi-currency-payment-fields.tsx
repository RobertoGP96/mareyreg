"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaymentMethodOption {
  value: string;
  label: string;
}

export interface CurrencyOption {
  currencyId: number;
  code: string;
  symbol: string;
  decimalPlaces: number;
  /** CUP por 1 unidad de esta moneda. null = sin tasa configurada (moneda base siempre 1). */
  rateToBase: number | null;
}

export interface PaymentFieldValue {
  currencyId: number;
  amountTendered: string;
  paymentMethod: string;
  reference: string;
}

interface Props {
  currencies: CurrencyOption[];
  baseCurrencyId: number;
  baseCurrencyCode: string;
  paymentMethods: PaymentMethodOption[];
  total: number;
  value: PaymentFieldValue[];
  onChange: (next: PaymentFieldValue[]) => void;
  className?: string;
}

function money(n: number, decimals = 2): string {
  return n.toLocaleString("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function rateFor(currencies: CurrencyOption[], currencyId: number): number | null {
  const c = currencies.find((x) => x.currencyId === currencyId);
  if (!c) return null;
  return c.rateToBase;
}

function equivalentBase(row: PaymentFieldValue, currencies: CurrencyOption[], baseCurrencyId: number): number | null {
  const amount = Number(row.amountTendered);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (row.currencyId === baseCurrencyId) return amount;
  const rate = rateFor(currencies, row.currencyId);
  if (rate == null) return null;
  return amount * rate;
}

/**
 * Filas de pago dinámicas (posiblemente multi-moneda): cada fila resuelve su
 * equivalente en moneda base EN VIVO, solo para mostrarlo — el server SIEMPRE
 * recalcula la conversión con la tasa vigente dentro de la transacción.
 */
export function MultiCurrencyPaymentFields({
  currencies,
  baseCurrencyId,
  baseCurrencyCode,
  paymentMethods,
  total,
  value,
  onChange,
  className,
}: Props) {
  const formId = useId();

  const addRow = () => {
    onChange([
      ...value,
      {
        currencyId: baseCurrencyId,
        amountTendered: "",
        paymentMethod: paymentMethods[0]?.value ?? "cash",
        reference: "",
      },
    ]);
  };

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, patch: Partial<PaymentFieldValue>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const equivalents = value.map((row) => equivalentBase(row, currencies, baseCurrencyId));
  const hasMissingRate = equivalents.some((e) => e == null);
  const paidBase = equivalents.reduce((s: number, e) => s + (e ?? 0), 0);
  const remaining = total - paidBase;
  const change = Math.max(0, -remaining);
  const missing = Math.max(0, remaining);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        {value.map((row, index) => {
          const currency = currencies.find((c) => c.currencyId === row.currencyId);
          const isBase = row.currencyId === baseCurrencyId;
          const equivalent = equivalents[index];
          const rate = rateFor(currencies, row.currencyId);

          return (
            <div key={`${formId}-${index}`} className="rounded-lg border border-border p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Método</label>
                  <Select
                    value={row.paymentMethod}
                    onValueChange={(v) => updateRow(index, { paymentMethod: v })}
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Moneda</label>
                  <Select
                    value={String(row.currencyId)}
                    onValueChange={(v) => updateRow(index, { currencyId: Number(v) })}
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.currencyId} value={String(c.currencyId)}>
                          {c.code}
                          {c.currencyId !== baseCurrencyId && c.rateToBase != null
                            ? ` · ${money(c.rateToBase, 2)}`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Monto entregado {currency ? `(${currency.code})` : ""}
                  </label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    className="h-11 font-mono tabular-nums"
                    value={row.amountTendered}
                    onChange={(e) => updateRow(index, { amountTendered: e.target.value })}
                  />
                </div>
                {value.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    onClick={() => removeRow(index)}
                    aria-label="Quitar pago"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {!isBase && (
                <p
                  className={cn(
                    "text-xs font-mono tabular-nums",
                    equivalent == null ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {equivalent == null
                    ? `Sin tasa de cambio configurada para ${currency?.code}.`
                    : `≈ ${money(equivalent, 0)} ${baseCurrencyCode} · tasa ${rate != null ? money(rate, 2) : "-"}`}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Button type="button" variant="outline" className="w-full h-11" onClick={addRow}>
        <Plus className="h-4 w-4" />
        Agregar pago
      </Button>

      <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total factura</span>
          <span className="font-mono tabular-nums font-medium">
            {money(total, 0)} {baseCurrencyCode}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pagado (equiv. {baseCurrencyCode})</span>
          <span className="font-mono tabular-nums font-medium">{money(paidBase, 0)}</span>
        </div>
        {hasMissingRate ? (
          <p className="text-xs text-destructive">
            Configura la tasa de cambio faltante en Divisas antes de cobrar.
          </p>
        ) : change > 0 ? (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
            <span>Vuelto</span>
            <span className="font-mono tabular-nums">
              + {money(change, 0)} {baseCurrencyCode}
            </span>
          </div>
        ) : missing > 0.001 ? (
          <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
            <span>Falta</span>
            <span className="font-mono tabular-nums">
              {money(missing, 0)} {baseCurrencyCode}
            </span>
          </div>
        ) : (
          <div className="flex justify-between text-muted-foreground">
            <span>Saldo</span>
            <span className="font-mono tabular-nums">0 {baseCurrencyCode}</span>
          </div>
        )}
      </div>
    </div>
  );
}
