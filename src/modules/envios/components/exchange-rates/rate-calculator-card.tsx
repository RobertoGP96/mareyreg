"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calculator, ArrowRightLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExchangeRateRuleRow } from "../../lib/types";
import { CurrencyChip } from "../shared/currency-chip";

type Props = {
  rules: ExchangeRateRuleRow[];
};

type Result =
  | { state: "idle" }
  | { state: "no-rule" }
  | { state: "no-amount" }
  | { state: "no-rate"; rangeIssue: string }
  | { state: "ok"; rate: number; min: number; max: number | null; result: number; baseCode: string; quoteCode: string };

export function RateCalculatorCard({ rules }: Props) {
  const activeRules = useMemo(() => rules.filter((r) => r.active && r.ranges.length > 0), [rules]);
  const [ruleId, setRuleId] = useState<string>(activeRules[0]?.ruleId ? String(activeRules[0].ruleId) : "");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"base_to_quote" | "quote_to_base">("base_to_quote");

  const rule = activeRules.find((r) => String(r.ruleId) === ruleId);

  const result: Result = useMemo(() => {
    if (!rule) return { state: "no-rule" };
    const n = Number(amount);
    if (!amount || !Number.isFinite(n) || n <= 0) return { state: "no-amount" };

    // El rango se evalúa siempre en moneda base de la regla.
    const amountInBase = direction === "base_to_quote" ? n : n; // simétrico — el amount es el monto de origen
    const sorted = [...rule.ranges].sort((a, b) => a.minAmount - b.minAmount);
    const match = sorted.find(
      (r) => amountInBase >= r.minAmount && (r.maxAmount === null || amountInBase < r.maxAmount)
    );
    if (!match) {
      return { state: "no-rate", rangeIssue: `Sin rango para ${amountInBase}` };
    }
    const result = direction === "base_to_quote" ? n * match.rate : n / match.rate;
    return {
      state: "ok",
      rate: match.rate,
      min: match.minAmount,
      max: match.maxAmount,
      result,
      baseCode: rule.baseCurrencyCode,
      quoteCode: rule.quoteCurrencyCode,
    };
  }, [rule, amount, direction]);

  // Si cambia la regla activa y quedó vacío, seleccionar la primera disponible
  useEffect(() => {
    if (!ruleId && activeRules[0]) setRuleId(String(activeRules[0].ruleId));
  }, [activeRules, ruleId]);

  if (activeRules.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-4 space-y-1">
        <h3 className="font-headline text-sm font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          Calculadora rápida
        </h3>
        <p className="text-xs text-muted-foreground">
          Crea una regla con al menos un rango activo para empezar a calcular.
        </p>
      </div>
    );
  }

  const fromCode = rule
    ? direction === "base_to_quote" ? rule.baseCurrencyCode : rule.quoteCurrencyCode
    : "";
  const toCode = rule
    ? direction === "base_to_quote" ? rule.quoteCurrencyCode : rule.baseCurrencyCode
    : "";

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-panel space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-headline text-sm font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[var(--ops-active)]" />
          Calculadora rápida
        </h3>
      </div>

      <Field label="Regla" icon={ArrowRightLeft}>
        <Select value={ruleId} onValueChange={setRuleId}>
          <SelectTrigger><SelectValue placeholder="Regla" /></SelectTrigger>
          <SelectContent>
            {activeRules.map((r) => (
              <SelectItem key={r.ruleId} value={String(r.ruleId)}>
                {r.name} · {r.baseCurrencyCode}→{r.quoteCurrencyCode}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {rule ? (
        <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-1">
          {(
            [
              { id: "base_to_quote", label: `${rule.baseCurrencyCode} → ${rule.quoteCurrencyCode}` },
              { id: "quote_to_base", label: `${rule.quoteCurrencyCode} → ${rule.baseCurrencyCode}` },
            ] as const
          ).map((t) => {
            const isActive = direction === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setDirection(t.id)}
                className={cn(
                  "flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                  isActive
                    ? "bg-background shadow ring-1 ring-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <Field label={`Monto en ${fromCode || "origen"}`} icon={Calculator}>
        <Input
          type="number"
          step="0.00000001"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>

      <div className="rounded-md bg-muted/30 px-3 py-3 ring-1 ring-inset ring-border space-y-2 min-h-[88px]">
        {result.state === "no-rule" || result.state === "no-amount" ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 opacity-40" />
            Ingresa un monto para calcular.
          </p>
        ) : result.state === "no-rate" ? (
          <p className="text-xs text-destructive">⚠ {result.rangeIssue}. Revisa los rangos definidos.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Recibirá</span>
              <span className="flex items-center gap-1.5 font-mono tabular-nums text-base font-semibold">
                {result.result.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                <CurrencyChip code={toCode} size="sm" />
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Tasa</span>
              <span className="font-mono tabular-nums">
                {result.rate.toLocaleString("es-MX", { maximumFractionDigits: 6 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Rango aplicable (en {result.baseCode})</span>
              <span className="font-mono tabular-nums">
                {result.min.toLocaleString("es-MX")} – {result.max === null ? "∞" : result.max.toLocaleString("es-MX")}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
