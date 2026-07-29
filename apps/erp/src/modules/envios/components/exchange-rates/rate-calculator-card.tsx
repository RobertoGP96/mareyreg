"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calculator, ArrowRightLeft, Loader2, AlertTriangle, Wand2, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExchangeRateRuleRow } from "../../lib/types";
import { formatBounds, isAmountInRule } from "../../lib/exchange-rate";
import { CurrencyChip } from "../shared/currency-chip";

type Props = {
  rules: ExchangeRateRuleRow[];
  /**
   * Regla seleccionada externamente (p. ej. al hacer click en una tarjeta).
   * Cuando se establece, la calculadora cambia a modo manual con esa regla
   * y ajusta el par automáticamente.
   */
  selectedRuleId?: number | null;
};

type SelectionMode = "auto" | "manual";

type ResolvedRule = {
  ruleId: number;
  name: string;
  rate: number;
  minAmount: number;
  maxAmount: number | null;
  minInclusive: boolean;
  maxInclusive: boolean;
};

type Result =
  | { state: "idle" }
  | { state: "no-pair" }
  | { state: "no-amount" }
  | { state: "no-rule-auto"; amount: number }
  | { state: "no-rule-manual" }
  | {
      state: "ok";
      rule: ResolvedRule;
      amount: number;
      result: number;
      baseCode: string;
      quoteCode: string;
      outOfRange: boolean;
    };

const fmtNum = (n: number) => n.toLocaleString("es-MX");

export function RateCalculatorCard({ rules, selectedRuleId }: Props) {
  const activeRules = useMemo(() => rules.filter((r) => r.active), [rules]);

  const pairs = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        baseCurrencyId: number;
        quoteCurrencyId: number;
        baseCurrencyCode: string;
        quoteCurrencyCode: string;
        rules: ExchangeRateRuleRow[];
      }
    >();
    for (const r of activeRules) {
      const key = `${r.baseCurrencyId}-${r.quoteCurrencyId}`;
      const prev = map.get(key);
      if (prev) prev.rules.push(r);
      else
        map.set(key, {
          key,
          baseCurrencyId: r.baseCurrencyId,
          quoteCurrencyId: r.quoteCurrencyId,
          baseCurrencyCode: r.baseCurrencyCode,
          quoteCurrencyCode: r.quoteCurrencyCode,
          rules: [r],
        });
    }
    return [...map.values()].map((p) => ({
      ...p,
      rules: [...p.rules].sort((a, b) => a.minAmount - b.minAmount),
    }));
  }, [activeRules]);

  const [pairKey, setPairKey] = useState<string>(pairs[0]?.key ?? "");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"base_to_quote" | "quote_to_base">("base_to_quote");
  const [mode, setMode] = useState<SelectionMode>("auto");
  const [manualRuleId, setManualRuleId] = useState<number | null>(null);

  const pair = pairs.find((p) => p.key === pairKey);

  useEffect(() => {
    if (!pairKey && pairs[0]) setPairKey(pairs[0].key);
  }, [pairs, pairKey]);

  // Reacciona a selección externa: ajusta par, cambia a modo manual y fija la regla.
  useEffect(() => {
    if (!selectedRuleId) return;
    const target = activeRules.find((r) => r.ruleId === selectedRuleId);
    if (!target) return;
    const targetKey = `${target.baseCurrencyId}-${target.quoteCurrencyId}`;
    setPairKey(targetKey);
    setMode("manual");
    setManualRuleId(target.ruleId);
  }, [selectedRuleId, activeRules]);

  // Si cambia el par o las reglas disponibles, asegurar que la regla manual
  // siga siendo válida. Si no, limpiar.
  useEffect(() => {
    if (!pair) {
      if (manualRuleId !== null) setManualRuleId(null);
      return;
    }
    const stillExists = pair.rules.some((r) => r.ruleId === manualRuleId);
    if (!stillExists) {
      setManualRuleId(pair.rules[0]?.ruleId ?? null);
    }
  }, [pair, manualRuleId]);

  const result: Result = useMemo(() => {
    if (!pair) return { state: "no-pair" };
    const n = Number(amount);
    const hasAmount = !!amount && Number.isFinite(n) && n > 0;

    let chosen: ResolvedRule | undefined;
    if (mode === "auto") {
      if (!hasAmount) return { state: "no-amount" };
      const match = pair.rules.find((r) => isAmountInRule(n, r));
      if (!match) return { state: "no-rule-auto", amount: n };
      chosen = match;
    } else {
      const m = pair.rules.find((r) => r.ruleId === manualRuleId);
      if (!m) return { state: "no-rule-manual" };
      chosen = m;
      if (!hasAmount) return { state: "no-amount" };
    }

    if (!chosen) return { state: "no-rule-manual" };

    const computed = direction === "base_to_quote" ? n * chosen.rate : n / chosen.rate;
    const outOfRange = !isAmountInRule(n, chosen);

    return {
      state: "ok",
      rule: chosen,
      amount: n,
      result: computed,
      baseCode: pair.baseCurrencyCode,
      quoteCode: pair.quoteCurrencyCode,
      outOfRange,
    };
  }, [pair, amount, direction, mode, manualRuleId]);

  if (pairs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-4 space-y-1">
        <h3 className="font-headline text-sm font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          Calculadora rápida
        </h3>
        <p className="text-xs text-muted-foreground">
          Crea una regla activa para empezar a calcular.
        </p>
      </div>
    );
  }

  const fromCode = pair
    ? direction === "base_to_quote" ? pair.baseCurrencyCode : pair.quoteCurrencyCode
    : "";
  const toCode = pair
    ? direction === "base_to_quote" ? pair.quoteCurrencyCode : pair.baseCurrencyCode
    : "";

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-panel space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-headline text-sm font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[var(--ops-active)]" />
          Calculadora rápida
        </h3>
      </div>

      <Field label="Par de monedas" icon={ArrowRightLeft}>
        <Select value={pairKey} onValueChange={setPairKey}>
          <SelectTrigger><SelectValue placeholder="Par" /></SelectTrigger>
          <SelectContent>
            {pairs.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.baseCurrencyCode}↔{p.quoteCurrencyCode} · {p.rules.length} {p.rules.length === 1 ? "regla" : "reglas"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-1">
        {(
          [
            { id: "auto", label: "Automática", icon: Wand2 },
            { id: "manual", label: "Elegir regla", icon: ListChecks },
          ] as const
        ).map((t) => {
          const isActive = mode === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setMode(t.id)}
              className={cn(
                "flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5",
                isActive
                  ? "bg-background shadow ring-1 ring-border text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3 w-3" />
              {t.label}
            </button>
          );
        })}
      </div>

      {mode === "manual" && pair ? (
        <Field label="Regla a aplicar" icon={ListChecks}>
          <Select
            value={manualRuleId ? String(manualRuleId) : ""}
            onValueChange={(v) => setManualRuleId(Number(v))}
          >
            <SelectTrigger><SelectValue placeholder="Selecciona una regla" /></SelectTrigger>
            <SelectContent>
              {pair.rules.map((r) => (
                <SelectItem key={r.ruleId} value={String(r.ruleId)}>
                  <span className="flex items-center justify-between gap-3 w-full">
                    <span className="truncate">{r.name}</span>
                    <span className="font-mono tabular-nums text-[11px] text-muted-foreground">
                      {formatBounds(r, fmtNum)} · {r.rate.toLocaleString("es-MX", { maximumFractionDigits: 6 })}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {pair ? (
        <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-1">
          {(
            [
              { id: "base_to_quote", label: `${pair.baseCurrencyCode} → ${pair.quoteCurrencyCode}` },
              { id: "quote_to_base", label: `${pair.quoteCurrencyCode} → ${pair.baseCurrencyCode}` },
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
        {result.state === "no-pair" || result.state === "no-amount" ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 opacity-40" />
            Ingresa un monto para calcular.
          </p>
        ) : result.state === "no-rule-auto" ? (
          <p className="text-xs text-destructive flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Sin regla activa que cubra <span className="font-mono tabular-nums">{fmtNum(result.amount)}</span>.
              Cambia a modo <strong>Elegir regla</strong> o ajusta los rangos.
            </span>
          </p>
        ) : result.state === "no-rule-manual" ? (
          <p className="text-xs text-muted-foreground">Selecciona una regla para aplicar.</p>
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
              <span>Regla</span>
              <span className="font-medium text-foreground/80 truncate max-w-[60%]" title={result.rule.name}>
                {result.rule.name}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Tasa</span>
              <span className="font-mono tabular-nums">
                {result.rule.rate.toLocaleString("es-MX", { maximumFractionDigits: 6 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Rango (en {result.baseCode})</span>
              <span className="font-mono tabular-nums">
                {formatBounds(result.rule, fmtNum)}
              </span>
            </div>
            {result.outOfRange ? (
              <div className="flex items-start gap-1.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1.5 text-[11px] ring-1 ring-amber-500/20">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  El monto <span className="font-mono tabular-nums">{fmtNum(result.amount)}</span> está fuera del rango de esta regla. El cálculo se muestra de forma informativa.
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
