"use client";

import { useMemo } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export type CoverageRule = {
  ruleId: number;
  name: string;
  minAmount: number;
  maxAmount: number | null;
  rate: number;
};

export type CoverageBarProps = {
  rules: CoverageRule[];
  baseCurrencyCode?: string;
  quoteCurrencyCode?: string;
  /** Punto de referencia visual para el final del eje (∞). Solo afecta el render. */
  visualMax?: number;
};

type Segment =
  | { kind: "covered"; from: number; to: number | null; ruleId: number; name: string; rate: number }
  | { kind: "gap"; from: number; to: number | null };

function computeSegments(rules: CoverageRule[]): {
  segments: Segment[];
  covered: boolean;
  visualEnd: number;
} {
  const sorted = [...rules].sort((a, b) => a.minAmount - b.minAmount);
  const segments: Segment[] = [];
  let cursor: number | null = 0;
  for (const r of sorted) {
    if (cursor === null) break;
    if (r.minAmount > cursor) {
      segments.push({ kind: "gap", from: cursor, to: r.minAmount });
    }
    segments.push({
      kind: "covered",
      from: r.minAmount,
      to: r.maxAmount,
      ruleId: r.ruleId,
      name: r.name,
      rate: r.rate,
    });
    if (r.maxAmount === null) {
      cursor = null;
    } else if (r.maxAmount > cursor) {
      cursor = r.maxAmount;
    }
  }
  if (cursor !== null) {
    segments.push({ kind: "gap", from: cursor, to: null });
  }
  const covered = !segments.some((s) => s.kind === "gap");
  const visualEnd = (() => {
    const finiteMax = sorted.reduce<number>((acc, r) => {
      if (r.maxAmount !== null && r.maxAmount > acc) return r.maxAmount;
      if (r.minAmount > acc) return r.minAmount;
      return acc;
    }, 0);
    return Math.max(finiteMax * 1.25, 100);
  })();
  return { segments, covered, visualEnd };
}

function fmt(n: number): string {
  return n.toLocaleString("es-MX", { maximumFractionDigits: 2 });
}

export function RateCoverageBar({
  rules,
  baseCurrencyCode,
  quoteCurrencyCode,
  visualMax,
}: CoverageBarProps) {
  const { segments, covered, visualEnd } = useMemo(() => computeSegments(rules), [rules]);
  const end = visualMax ?? visualEnd;

  if (rules.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        Sin reglas asignadas para este par. La cuenta no podrá convertir.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        {covered ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Cobertura completa [0, ∞)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Cobertura incompleta — algunos montos no encontrarán tasa
          </span>
        )}
      </div>
      <div className="relative h-7 w-full overflow-hidden rounded bg-muted/40 ring-1 ring-inset ring-border">
        <div className="absolute inset-0 flex">
          {segments.map((seg, i) => {
            const segEnd = seg.to === null ? end : Math.min(seg.to, end);
            const segStart = Math.min(seg.from, end);
            const widthPct = end > 0 ? Math.max(((segEnd - segStart) / end) * 100, 1) : 0;
            const isGap = seg.kind === "gap";
            const title = isGap
              ? `Sin cobertura: [${fmt(seg.from)}, ${seg.to === null ? "∞" : fmt(seg.to)})`
              : `${seg.name}: [${fmt(seg.from)}, ${seg.to === null ? "∞" : fmt(seg.to)}) @ ${fmt(seg.rate)}`;
            return (
              <div
                key={i}
                title={title}
                className={`h-full border-r border-background/40 last:border-r-0 ${
                  isGap
                    ? "bg-rose-500/40 dark:bg-rose-500/30"
                    : "bg-emerald-500/60 dark:bg-emerald-500/50"
                }`}
                style={{ width: `${widthPct}%` }}
              />
            );
          })}
        </div>
      </div>
      <div className="flex justify-between text-[10px] font-mono tabular-nums text-muted-foreground">
        <span>0</span>
        <span>{fmt(end)}</span>
        <span>∞</span>
      </div>
      {baseCurrencyCode && quoteCurrencyCode && (
        <div className="text-[10px] text-muted-foreground">
          Eje en {baseCurrencyCode}; tasa en {quoteCurrencyCode}/{baseCurrencyCode}.
        </div>
      )}
    </div>
  );
}
