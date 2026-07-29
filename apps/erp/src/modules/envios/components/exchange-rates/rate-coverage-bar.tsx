"use client";

import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, Layers, Infinity as InfinityIcon } from "lucide-react";
import { formatBounds } from "../../lib/exchange-rate";

const DEFAULT_COLOR = "bg-emerald-500/60 dark:bg-emerald-500/50";
const OVERLAP_RING = "ring-1 ring-amber-500/70";
const INFINITE_RESERVE_PCT = 12;

export type CoverageRule = {
  ruleId: number;
  name: string;
  minAmount: number;
  maxAmount: number | null;
  minInclusive: boolean;
  maxInclusive: boolean;
  rate: number;
  colorClass?: string;
};

export type CoverageBarProps = {
  rules: CoverageRule[];
  baseCurrencyCode?: string;
  quoteCurrencyCode?: string;
  /** Punto de referencia visual para el final del eje finito. Solo afecta el render. */
  visualMax?: number;
};

type CoveredSegment = {
  kind: "covered";
  ruleId: number;
  name: string;
  rate: number;
  from: number;
  to: number | null;
  minInclusive: boolean;
  maxInclusive: boolean;
  colorClass: string;
  overlap: boolean;
};

type GapSegment = {
  kind: "gap";
  from: number;
  to: number | null;
};

type Segment = CoveredSegment | GapSegment;

type ComputeResult = {
  segments: Segment[];
  hasGaps: boolean;
  hasOverlaps: boolean;
  hasOpenEnded: boolean;
  finiteMax: number;
};

function computeSegments(rules: CoverageRule[]): ComputeResult {
  const sorted = [...rules].sort((a, b) => a.minAmount - b.minAmount);
  const segments: Segment[] = [];
  let cursor = 0;
  let hasOverlaps = false;
  let hasOpenEnded = false;
  let finiteMax = 0;

  for (const r of sorted) {
    const overlap = r.minAmount < cursor;
    if (!overlap && r.minAmount > cursor) {
      segments.push({ kind: "gap", from: cursor, to: r.minAmount });
    }
    segments.push({
      kind: "covered",
      ruleId: r.ruleId,
      name: r.name,
      rate: r.rate,
      from: r.minAmount,
      to: r.maxAmount,
      minInclusive: r.minInclusive,
      maxInclusive: r.maxInclusive,
      colorClass: r.colorClass ?? DEFAULT_COLOR,
      overlap,
    });
    if (overlap) hasOverlaps = true;
    if (r.maxAmount === null) {
      hasOpenEnded = true;
      if (r.minAmount > finiteMax) finiteMax = r.minAmount;
    } else {
      if (r.maxAmount > finiteMax) finiteMax = r.maxAmount;
      if (r.maxAmount > cursor) cursor = r.maxAmount;
    }
  }

  if (!hasOpenEnded && cursor < Number.POSITIVE_INFINITY) {
    segments.push({ kind: "gap", from: cursor, to: null });
  }

  const hasGaps = segments.some((s) => s.kind === "gap");
  return { segments, hasGaps, hasOverlaps, hasOpenEnded, finiteMax };
}

function fmt(n: number): string {
  return n.toLocaleString("es-MX", { maximumFractionDigits: 2 });
}

function fmtRate(n: number): string {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

type Tick = { value: number; pct: number };

function buildTicks(segments: Segment[], visualEnd: number): Tick[] {
  if (visualEnd <= 0) return [];
  const values = new Set<number>();
  values.add(0);
  for (const seg of segments) {
    if (seg.from > 0 && seg.from <= visualEnd) values.add(seg.from);
    if (seg.kind === "covered" && seg.to !== null && seg.to <= visualEnd) values.add(seg.to);
    if (seg.kind === "gap" && seg.to !== null && seg.to <= visualEnd) values.add(seg.to);
  }
  const sorted = [...values].sort((a, b) => a - b);
  // Dedupe ticks demasiado cercanos (< 6% del eje)
  const out: Tick[] = [];
  let lastPct = -Infinity;
  for (const v of sorted) {
    const pct = (v / visualEnd) * 100;
    if (pct - lastPct < 6 && out.length > 0) continue;
    out.push({ value: v, pct });
    lastPct = pct;
  }
  return out;
}

export function RateCoverageBar({
  rules,
  baseCurrencyCode,
  quoteCurrencyCode,
  visualMax,
}: CoverageBarProps) {
  const { segments, hasGaps, hasOverlaps, hasOpenEnded, finiteMax } = useMemo(
    () => computeSegments(rules),
    [rules],
  );

  const hasInfiniteTail = hasOpenEnded || segments.some((s) => s.to === null);

  // visualEnd: extremo derecho del eje numérico finito (sin buffer arbitrario).
  // Cuando hay tail infinito se reserva ~12% del ancho como zona "→ ∞".
  const visualEnd = useMemo(() => {
    if (visualMax !== undefined) return visualMax;
    if (finiteMax > 0) return finiteMax;
    return 100;
  }, [finiteMax, visualMax]);

  const finiteWidthPct = hasInfiniteTail ? 100 - INFINITE_RESERVE_PCT : 100;

  const ticks = useMemo(
    () => buildTicks(segments, visualEnd),
    [segments, visualEnd],
  );
  const dense = ticks.length > 4;

  if (rules.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        Sin reglas asignadas para este par. La cuenta no podrá convertir.
      </div>
    );
  }

  const positionForValue = (v: number): number => {
    if (visualEnd <= 0) return 0;
    const pct = (v / visualEnd) * finiteWidthPct;
    return Math.max(0, Math.min(pct, finiteWidthPct));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {hasGaps ? (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Cobertura incompleta
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Cobertura completa
          </span>
        )}
        {hasOverlaps && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
            <Layers className="h-3 w-3" /> Reglas solapadas
          </span>
        )}
        {hasOpenEnded && (
          <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-700 dark:text-sky-400">
            <InfinityIcon className="h-3 w-3" /> Open-ended hasta ∞
          </span>
        )}
      </div>

      <div className="relative h-7 w-full rounded bg-muted/40 ring-1 ring-inset ring-border overflow-hidden">
        {hasInfiniteTail && (
          <div
            aria-hidden
            className="absolute top-0 bottom-0 border-l border-dashed border-border z-30 pointer-events-none"
            style={{ left: `${finiteWidthPct}%` }}
          />
        )}
        {segments.map((seg, i) => {
          const isGap = seg.kind === "gap";
          const fromPct = positionForValue(seg.from);
          const toPct = seg.to === null ? 100 : positionForValue(seg.to);
          const widthPct = toPct - fromPct;
          if (widthPct <= 0) return null;
          const overlap = !isGap && seg.overlap;
          const baseColor = isGap
            ? "bg-rose-500/40 dark:bg-rose-500/30"
            : seg.colorClass;
          const opacity = overlap ? "opacity-60" : "";
          const ring = overlap ? OVERLAP_RING : "";
          const z = overlap ? "z-20" : isGap ? "z-0" : "z-10";
          const title = isGap
            ? `Sin cobertura: [${fmt(seg.from)}, ${seg.to === null ? "∞" : fmt(seg.to)})`
            : `${seg.name}${overlap ? " (solapado)" : ""}: ${formatBounds(
                {
                  minAmount: seg.from,
                  maxAmount: seg.to,
                  minInclusive: seg.minInclusive,
                  maxInclusive: seg.maxInclusive,
                },
                fmt,
              )} @ ${fmtRate(seg.rate)}`;
          return (
            <div
              key={`${seg.kind}-${i}`}
              title={title}
              style={{ left: `${fromPct}%`, width: `${widthPct}%`, minWidth: "2px" }}
              className={`absolute top-0 h-full ${z} ${baseColor} ${opacity} ${ring}`}
            />
          );
        })}
      </div>

      <div className={`relative h-6 w-full ${dense ? "sm:h-6 h-9" : ""}`}>
        {ticks.map((t) => {
          const leftPct = (t.value / visualEnd) * finiteWidthPct;
          return (
            <div
              key={t.value}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${leftPct}%`, transform: "translateX(-50%)" }}
            >
              <span aria-hidden className="block w-px h-1.5 bg-border" />
              <span
                className={`mt-0.5 font-mono tabular-nums text-[10px] text-muted-foreground whitespace-nowrap ${
                  dense ? "origin-top -rotate-45 sm:rotate-0" : ""
                }`}
              >
                {fmt(t.value)}
              </span>
            </div>
          );
        })}
        {hasInfiniteTail && (
          <div className="absolute top-0 right-0 flex flex-col items-center">
            <span aria-hidden className="block w-px h-1.5 bg-border" />
            <span className="mt-0.5 font-mono tabular-nums text-[10px] text-muted-foreground">∞</span>
          </div>
        )}
      </div>

      {baseCurrencyCode && quoteCurrencyCode && (
        <div className="text-[10px] text-muted-foreground">
          Eje en {baseCurrencyCode}; tasa en {quoteCurrencyCode}/{baseCurrencyCode}.
        </div>
      )}
    </div>
  );
}
