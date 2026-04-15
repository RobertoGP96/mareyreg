import { NextResponse } from "next/server";

// Cache for 1 hour — international FX doesn't need sub-hour precision for a dashboard.
export const revalidate = 3600;

export const CURRENCIES = ["EUR", "CAD", "GBP", "MXN"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type ExchangeRatesResponse = {
  rates: Partial<Record<Currency, number>>;
  base: "USD";
  source: string;
  updatedAt: string | null;
  fetchedAt: string;
  error?: string;
};

/**
 * USD → {EUR, CAD, GBP, MXN} via open.er-api.com.
 * Free, no API key, updated daily from aggregated central-bank sources.
 */
export async function GET() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const rates: Partial<Record<Currency, number>> = {};
    for (const code of CURRENCIES) {
      const value = data?.rates?.[code];
      if (typeof value === "number") rates[code] = value;
    }

    const payload: ExchangeRatesResponse = {
      rates,
      base: "USD",
      source: "open.er-api.com",
      updatedAt: data?.time_last_update_utc ?? null,
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    const payload: ExchangeRatesResponse = {
      rates: {},
      base: "USD",
      source: "open.er-api.com",
      updatedAt: null,
      fetchedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : "unknown",
    };
    return NextResponse.json(payload, { status: 502 });
  }
}
