"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ExchangeRatesResponse } from "@/app/api/exchange-rates/route";

type RateCardDef = {
  key: "mxn" | "cupOfficial" | "cupInformal";
  label: string;
  sublabel: string;
  currency: string;
  flag: string;
  accent: "brand" | "info" | "teal" | "amber";
};

const RATE_CARDS: RateCardDef[] = [
  {
    key: "mxn",
    label: "Peso Mexicano",
    sublabel: "USD → MXN",
    currency: "MXN",
    flag: "🇲🇽",
    accent: "teal",
  },
  {
    key: "cupOfficial",
    label: "CUP Oficial",
    sublabel: "USD → CUP (CADECA)",
    currency: "CUP",
    flag: "🇨🇺",
    accent: "info",
  },
  {
    key: "cupInformal",
    label: "CUP Informal",
    sublabel: "USD → CUP (elToque)",
    currency: "CUP",
    flag: "🇨🇺",
    accent: "amber",
  },
];

const accentStyles: Record<
  RateCardDef["accent"],
  { iconBg: string; iconColor: string; glow: string; ring: string }
> = {
  brand:  { iconBg: "from-[var(--brand)]/20 to-[var(--brand)]/5",      iconColor: "text-[var(--brand)]",   glow: "from-[var(--brand)]/10",    ring: "ring-[var(--brand)]/20" },
  info:   { iconBg: "from-[var(--info)]/20 to-[var(--info)]/5",        iconColor: "text-[var(--info)]",    glow: "from-[var(--info)]/10",     ring: "ring-[var(--info)]/20" },
  teal:   { iconBg: "from-[var(--chart-2)]/25 to-[var(--chart-2)]/5",  iconColor: "text-[var(--chart-2)]", glow: "from-[var(--chart-2)]/10",  ring: "ring-[var(--chart-2)]/20" },
  amber:  { iconBg: "from-[var(--warning)]/25 to-[var(--warning)]/5",  iconColor: "text-[var(--warning)]", glow: "from-[var(--warning)]/10",  ring: "ring-[var(--warning)]/20" },
};

function formatRate(value: number | null, currency: string): string {
  if (value == null) return "—";
  const digits = value >= 100 ? 2 : 4;
  return `$${value.toLocaleString("es-MX", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ${currency}`;
}

function formatUpdated(updatedAt: string | null): string {
  if (!updatedAt) return "";
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return updatedAt;
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ExchangeRatesCard() {
  const [data, setData] = useState<ExchangeRatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await fetch("/api/exchange-rates", {
        cache: force ? "no-store" : "default",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ExchangeRatesResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-3"
      aria-label="Tipos de cambio del dólar"
    >
      <header className="flex items-end justify-between px-1">
        <div>
          <h2 className="text-base md:text-lg font-semibold font-headline text-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[var(--brand)]" />
            Tipo de cambio del dólar
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            Referencias de mercado actualizadas cada hora.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing || loading}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[0.72rem] font-semibold text-muted-foreground transition-colors",
            "hover:text-foreground hover:border-foreground/20 disabled:opacity-50 disabled:cursor-not-allowed",
          )}
          aria-label="Actualizar tipos de cambio"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
          />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-3 py-2 text-xs text-[var(--destructive)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>No se pudieron cargar las tasas: {error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {RATE_CARDS.map((card, i) => {
          const style = accentStyles[card.accent];
          const rate = data?.[card.key];

          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: i * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={cn(
                "group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-panel ring-1",
                style.ring,
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br to-transparent blur-2xl opacity-80",
                  style.glow,
                )}
              />

              <div className="relative flex items-start justify-between mb-5">
                <div
                  className={cn(
                    "flex size-11 items-center justify-center rounded-lg bg-gradient-to-br ring-1 ring-inset ring-border/60",
                    style.iconBg,
                  )}
                >
                  <span className="text-xl leading-none" aria-hidden>
                    {card.flag}
                  </span>
                </div>
                <TrendingUp
                  className={cn(
                    "h-4 w-4 transition-colors",
                    rate?.value != null
                      ? style.iconColor
                      : "text-muted-foreground/40",
                  )}
                />
              </div>

              <div className="relative space-y-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {card.label}
                  </p>
                  <span className="text-[0.65rem] text-muted-foreground/70">
                    {card.sublabel}
                  </span>
                </div>

                {loading ? (
                  <Skeleton className="h-9 w-32" />
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        "text-2xl md:text-3xl font-bold font-headline tabular-nums",
                        rate?.value != null
                          ? "text-foreground"
                          : "text-muted-foreground/60",
                      )}
                    >
                      {formatRate(rate?.value ?? null, card.currency)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[0.68rem] text-muted-foreground/70 truncate">
                    {rate?.source ?? "—"}
                  </span>
                  {rate?.updatedAt && (
                    <span className="text-[0.68rem] text-muted-foreground/60 tabular-nums">
                      {formatUpdated(rate.updatedAt)}
                    </span>
                  )}
                </div>

                {rate?.error && (
                  <p className="mt-1 flex items-start gap-1 text-[0.68rem] text-[var(--warning)]">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span className="truncate" title={rate.error}>
                      {rate.error}
                    </span>
                  </p>
                )}
              </div>

              <div className="mt-4 h-0.5 w-full overflow-hidden rounded-full bg-border/60">
                <div
                  className={cn(
                    "h-full bg-gradient-to-r transition-transform duration-500 origin-left",
                    style.iconBg.replace("/5", "/80").replace("/20", ""),
                    rate?.value != null ? "scale-x-100" : "scale-x-[0.15]",
                  )}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="px-1 text-[0.68rem] text-muted-foreground/70 flex items-center gap-1">
        <ExternalLink className="h-3 w-3" />
        Fuentes: open.er-api.com (MXN / CUP oficial) y elToque (CUP informal).
        Referencias informativas, no para operaciones financieras.
      </p>
    </motion.section>
  );
}
