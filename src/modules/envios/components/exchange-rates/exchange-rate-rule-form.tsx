"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { Checkbox } from "@/components/ui/checkbox";
import { LineChart, Type, Hash, Pin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ExchangeRateRuleInput } from "../../lib/schemas";
import type { ExchangeRateRuleRow } from "../../lib/types";

type CurrencyOption = { currencyId: number; code: string; symbol: string };

export interface ExchangeRateRuleFormProps {
  defaultValues?: Partial<ExchangeRateRuleRow>;
  currencies: CurrencyOption[];
  onSubmit: (payload: ExchangeRateRuleInput) => Promise<{ success: boolean; error?: string }>;
  onCancel?: () => void;
  lockBaseCurrency?: boolean;
  lockQuoteCurrency?: boolean;
  submitLabel?: string;
  showHeader?: boolean;
  headerTitle?: string;
  headerDescription?: string;
}

export function ExchangeRateRuleForm({
  defaultValues,
  currencies,
  onSubmit,
  onCancel,
  lockBaseCurrency,
  lockQuoteCurrency,
  submitLabel,
  showHeader = true,
  headerTitle,
  headerDescription,
}: ExchangeRateRuleFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [baseCurrencyId, setBaseCurrencyId] = useState<string>(
    defaultValues?.baseCurrencyId ? String(defaultValues.baseCurrencyId) : "",
  );
  const [quoteCurrencyId, setQuoteCurrencyId] = useState<string>(
    defaultValues?.quoteCurrencyId ? String(defaultValues.quoteCurrencyId) : "",
  );
  const [minAmount, setMinAmount] = useState(
    defaultValues?.minAmount !== undefined ? String(defaultValues.minAmount) : "0",
  );
  const [maxAmount, setMaxAmount] = useState(
    defaultValues?.maxAmount === null || defaultValues?.maxAmount === undefined
      ? ""
      : String(defaultValues.maxAmount),
  );
  const [rate, setRate] = useState(
    defaultValues?.rate !== undefined ? String(defaultValues.rate) : "",
  );
  const [minInclusive, setMinInclusive] = useState<boolean>(
    defaultValues?.minInclusive ?? true,
  );
  const [maxInclusive, setMaxInclusive] = useState<boolean>(
    defaultValues?.maxInclusive ?? false,
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!defaultValues) return;
    setName(defaultValues.name ?? "");
    setBaseCurrencyId(
      defaultValues.baseCurrencyId ? String(defaultValues.baseCurrencyId) : "",
    );
    setQuoteCurrencyId(
      defaultValues.quoteCurrencyId ? String(defaultValues.quoteCurrencyId) : "",
    );
    setMinAmount(
      defaultValues.minAmount !== undefined ? String(defaultValues.minAmount) : "0",
    );
    setMaxAmount(
      defaultValues.maxAmount === null || defaultValues.maxAmount === undefined
        ? ""
        : String(defaultValues.maxAmount),
    );
    setRate(defaultValues.rate !== undefined ? String(defaultValues.rate) : "");
    setMinInclusive(defaultValues.minInclusive ?? true);
    setMaxInclusive(defaultValues.maxInclusive ?? false);
  }, [defaultValues]);

  const validate = (): string | null => {
    if (!name.trim()) return "Nombre requerido";
    if (!baseCurrencyId) return "Selecciona moneda base";
    if (!quoteCurrencyId) return "Selecciona moneda destino";
    if (baseCurrencyId === quoteCurrencyId) return "Base y destino deben ser distintas";
    const min = Number(minAmount);
    if (!Number.isFinite(min) || min < 0) return "Mínimo no puede ser negativo";
    if (maxAmount !== "") {
      const max = Number(maxAmount);
      if (!Number.isFinite(max) || max <= min) return "Máximo debe ser mayor que mínimo";
    }
    const r = Number(rate);
    if (!rate || !Number.isFinite(r) || r <= 0) return "Tasa debe ser mayor a 0";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    const payload: ExchangeRateRuleInput = {
      name: name.trim(),
      baseCurrencyId: Number(baseCurrencyId),
      quoteCurrencyId: Number(quoteCurrencyId),
      minAmount: Number(minAmount),
      maxAmount: maxAmount === "" ? null : Number(maxAmount),
      minInclusive,
      maxInclusive: maxAmount === "" ? false : maxInclusive,
      rate: Number(rate),
    };
    const result = await onSubmit(payload);
    setSubmitting(false);
    if (!result.success && result.error) toast.error(result.error);
  };

  const baseCode = currencies.find((c) => String(c.currencyId) === baseCurrencyId)?.code;
  const quoteCode = currencies.find((c) => String(c.currencyId) === quoteCurrencyId)?.code;

  return (
    <>
      {showHeader && (
        <FormDialogHeader
          icon={LineChart}
          title={headerTitle ?? (defaultValues?.ruleId ? "Editar regla de tasa" : "Nueva regla de tasa")}
          description={
            headerDescription ??
            "Define un par de monedas, el rango de monto y la tasa. Para cubrir todo el espectro asigna varias reglas a una cuenta."
          }
        />
      )}
      <div className="space-y-4 mt-4">
        <FormSection icon={LineChart} title="Identificación">
          <Field label="Nombre" icon={Type} required>
            <Input
              placeholder="USD → CUP estándar"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Moneda base" icon={Hash} required>
              <Select
                value={baseCurrencyId}
                onValueChange={setBaseCurrencyId}
                disabled={lockBaseCurrency}
              >
                <SelectTrigger><SelectValue placeholder="Base" /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.currencyId} value={String(c.currencyId)}>{c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Moneda destino" icon={Hash} required>
              <Select
                value={quoteCurrencyId}
                onValueChange={setQuoteCurrencyId}
                disabled={lockQuoteCurrency}
              >
                <SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.currencyId} value={String(c.currencyId)}>{c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FormSection>

        <FormSection icon={Pin} title="Rango y tasa">
          <p className="text-xs text-muted-foreground">
            Define el rango de monto que cubre la regla y si cada extremo es inclusivo o
            exclusivo. Por defecto, mínimo incluido y máximo excluido — la convención estándar.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Mínimo" required>
              <Input
                type="number"
                step="0.00000001"
                inputMode="decimal"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
              />
              <label className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={minInclusive}
                  onCheckedChange={(v) => setMinInclusive(v === true)}
                />
                Incluir mínimo (cierre por izquierda)
              </label>
            </Field>
            <Field label="Máximo (vacío = ∞)">
              <Input
                type="number"
                step="0.00000001"
                inputMode="decimal"
                placeholder="∞"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
              />
              <label
                className={`mt-1.5 flex items-center gap-2 text-xs cursor-pointer ${
                  maxAmount === "" ? "text-muted-foreground/40" : "text-muted-foreground"
                }`}
              >
                <Checkbox
                  checked={maxAmount !== "" && maxInclusive}
                  onCheckedChange={(v) => setMaxInclusive(v === true)}
                  disabled={maxAmount === ""}
                />
                Incluir máximo (cierre por derecha)
              </label>
            </Field>
          </div>
          <div className="rounded-md bg-muted/40 px-2.5 py-1.5 text-xs font-mono tabular-nums text-muted-foreground">
            Intervalo: <span className="text-foreground">
              {minInclusive ? "[" : "("}
              {minAmount === "" ? "?" : minAmount}
              , {maxAmount === "" ? "∞" : maxAmount}
              {maxAmount !== "" && maxInclusive ? "]" : ")"}
            </span>
          </div>
          <Field
            label={baseCode && quoteCode ? `Tasa (${quoteCode} por ${baseCode})` : "Tasa"}
            required
          >
            <Input
              type="number"
              step="0.00000001"
              inputMode="decimal"
              placeholder="0.00"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </Field>
        </FormSection>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        )}
        <Button
          type="button"
          variant="brand"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Guardando…" : submitLabel ?? (defaultValues?.ruleId ? "Actualizar" : "Crear")}
        </Button>
      </div>
    </>
  );
}
