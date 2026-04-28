"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import {
  LineChart, Plus, Type, Hash, Calculator, Pin, BarChart3, Trash2, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ExchangeRateRuleInput } from "../../lib/schemas";
import type { ExchangeRateRuleRow } from "../../lib/types";

type CurrencyOption = { currencyId: number; code: string; symbol: string };

type RangeRow = { minAmount: string; maxAmount: string; rate: string };

const RANGE_COLORS = [
  "border-l-sky-500",
  "border-l-emerald-500",
  "border-l-amber-500",
  "border-l-violet-500",
  "border-l-rose-500",
];

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
  const [kind, setKind] = useState<"fixed" | "range">(defaultValues?.kind ?? "range");
  const [baseCurrencyId, setBaseCurrencyId] = useState<string>(
    defaultValues?.baseCurrencyId ? String(defaultValues.baseCurrencyId) : ""
  );
  const [quoteCurrencyId, setQuoteCurrencyId] = useState<string>(
    defaultValues?.quoteCurrencyId ? String(defaultValues.quoteCurrencyId) : ""
  );
  const initialRanges: RangeRow[] = defaultValues?.ranges?.length
    ? defaultValues.ranges.map((rg) => ({
        minAmount: String(rg.minAmount),
        maxAmount: rg.maxAmount === null ? "" : String(rg.maxAmount),
        rate: String(rg.rate),
      }))
    : [{ minAmount: "0", maxAmount: "", rate: "" }];
  const [ranges, setRanges] = useState<RangeRow[]>(initialRanges);
  const [fixedRate, setFixedRate] = useState<string>(
    defaultValues?.kind === "fixed" && defaultValues.ranges?.[0]
      ? String(defaultValues.ranges[0].rate)
      : ""
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!defaultValues) return;
    setName(defaultValues.name ?? "");
    setKind(defaultValues.kind ?? "range");
    setBaseCurrencyId(defaultValues.baseCurrencyId ? String(defaultValues.baseCurrencyId) : "");
    setQuoteCurrencyId(defaultValues.quoteCurrencyId ? String(defaultValues.quoteCurrencyId) : "");
    if (defaultValues.kind === "fixed") {
      setFixedRate(defaultValues.ranges?.[0] ? String(defaultValues.ranges[0].rate) : "");
      setRanges([{
        minAmount: "0",
        maxAmount: "",
        rate: defaultValues.ranges?.[0] ? String(defaultValues.ranges[0].rate) : "",
      }]);
    } else {
      setFixedRate("");
      setRanges(
        defaultValues.ranges?.length
          ? defaultValues.ranges.map((rg) => ({
              minAmount: String(rg.minAmount),
              maxAmount: rg.maxAmount === null ? "" : String(rg.maxAmount),
              rate: String(rg.rate),
            }))
          : [{ minAmount: "0", maxAmount: "", rate: "" }]
      );
    }
  }, [defaultValues]);

  const switchKind = (next: "fixed" | "range") => {
    if (next === kind) return;
    if (next === "fixed") {
      const firstRate = ranges[0]?.rate || "";
      setFixedRate(firstRate);
    } else {
      setRanges([{ minAmount: "0", maxAmount: "", rate: fixedRate }]);
    }
    setKind(next);
  };

  const updateRange = (i: number, key: keyof RangeRow, val: string) => {
    setRanges((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  };
  const addRange = () => {
    setRanges((prev) => [
      ...prev,
      { minAmount: prev[prev.length - 1]?.maxAmount || "", maxAmount: "", rate: "" },
    ]);
  };
  const removeRange = (i: number) => {
    setRanges((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  };

  const rangeIssues = useMemo(() => {
    if (kind === "fixed") return [];
    const issues: string[] = [];
    const parsed = ranges.map((r, i) => ({
      i,
      min: Number(r.minAmount),
      max: r.maxAmount === "" ? null : Number(r.maxAmount),
      rate: Number(r.rate),
    }));
    const sorted = [...parsed].sort((a, b) => a.min - b.min);
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i], n = sorted[i + 1];
      if (c.min < 0) issues.push(`Rango ${c.i + 1}: mínimo no puede ser negativo`);
      if (c.max != null && c.max <= c.min) issues.push(`Rango ${c.i + 1}: máximo debe ser mayor que mínimo`);
      if (!c.rate || c.rate <= 0) issues.push(`Rango ${c.i + 1}: tasa debe ser mayor a 0`);
      if (n) {
        if (c.max == null) {
          issues.push(`Solo el último rango puede ser abierto (∞)`);
          break;
        }
        if (n.min < c.max) {
          issues.push(`Rango ${c.i + 1} y ${n.i + 1} se solapan`);
        }
      }
    }
    return issues;
  }, [ranges, kind]);

  const validate = () => {
    if (!name.trim()) return "Nombre requerido";
    if (!baseCurrencyId) return "Selecciona moneda base";
    if (!quoteCurrencyId) return "Selecciona moneda destino";
    if (baseCurrencyId === quoteCurrencyId) return "Base y destino deben ser distintas";
    if (kind === "fixed") {
      const r = Number(fixedRate);
      if (!fixedRate || !Number.isFinite(r) || r <= 0) return "Tasa fija debe ser mayor a 0";
      return null;
    }
    if (rangeIssues.length) return rangeIssues[0];
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    const payload: ExchangeRateRuleInput = {
      name: name.trim(),
      kind,
      baseCurrencyId: Number(baseCurrencyId),
      quoteCurrencyId: Number(quoteCurrencyId),
      ranges: kind === "fixed"
        ? [{ minAmount: 0, maxAmount: null, rate: Number(fixedRate) }]
        : ranges.map((r) => ({
            minAmount: Number(r.minAmount),
            maxAmount: r.maxAmount === "" ? null : Number(r.maxAmount),
            rate: Number(r.rate),
          })),
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
          description={headerDescription ?? "Define el par de monedas y los rangos de monto con su tasa correspondiente."}
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
          <div className="grid grid-cols-2 gap-3">
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

        <FormSection icon={Calculator} title="Tipo de tasa">
          <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-1">
            {(
              [
                { id: "fixed" as const, label: "Tasa fija", icon: Pin },
                { id: "range" as const, label: "Por rangos", icon: BarChart3 },
              ]
            ).map((opt) => {
              const Icon = opt.icon;
              const isActive = kind === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => switchKind(opt.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors",
                    isActive
                      ? "bg-background shadow ring-1 ring-border text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {kind === "fixed" ? (
            <>
              <p className="text-xs text-muted-foreground">
                Una sola tasa que se aplica a cualquier monto convertido por esta regla.
              </p>
              <Field
                label={baseCode && quoteCode ? `Tasa (${quoteCode} por ${baseCode})` : "Tasa"}
                icon={Pin}
                required
              >
                <Input
                  type="number"
                  step="0.00000001"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={fixedRate}
                  onChange={(e) => setFixedRate(e.target.value)}
                />
              </Field>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Cada rango define una tasa para un intervalo de monto en moneda base.
                El último rango puede dejarse abierto (∞) para &ldquo;cualquier monto mayor&rdquo;.
              </p>
              <div className="space-y-2">
                {ranges.map((r, i) => (
                  <div
                    key={i}
                    className={`grid grid-cols-12 gap-2 rounded-md bg-muted/20 p-2 border-l-4 ${RANGE_COLORS[i % RANGE_COLORS.length]}`}
                  >
                    <div className="col-span-4">
                      <label className="text-[10px] font-medium text-muted-foreground">Mínimo</label>
                      <Input
                        type="number"
                        step="0.00000001"
                        value={r.minAmount}
                        onChange={(e) => updateRange(i, "minAmount", e.target.value)}
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="text-[10px] font-medium text-muted-foreground">Máximo (vacío = ∞)</label>
                      <Input
                        type="number"
                        step="0.00000001"
                        value={r.maxAmount}
                        onChange={(e) => updateRange(i, "maxAmount", e.target.value)}
                        placeholder="∞"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] font-medium text-muted-foreground">Tasa</label>
                      <Input
                        type="number"
                        step="0.00000001"
                        value={r.rate}
                        onChange={(e) => updateRange(i, "rate", e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 flex items-end justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => removeRange(i)}
                        disabled={ranges.length === 1}
                        aria-label="Eliminar rango"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" onClick={addRange} className="w-full">
                <Plus className="h-4 w-4" /> Añadir rango
              </Button>
              {rangeIssues.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-destructive">
                  {rangeIssues.map((msg, i) => (<li key={i}>• {msg}</li>))}
                </ul>
              )}
            </>
          )}
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
          disabled={submitting || rangeIssues.length > 0}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Guardando…" : submitLabel ?? (defaultValues?.ruleId ? "Actualizar" : "Crear")}
        </Button>
      </div>
    </>
  );
}
