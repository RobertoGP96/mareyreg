import { NextResponse } from "next/server";

// Cache for 1 hour — exchange rates don't need sub-hour precision for a dashboard.
export const revalidate = 3600;

type RateResult = {
  value: number | null;
  source: string;
  updatedAt: string | null;
  error?: string;
};

export type ExchangeRatesResponse = {
  mxn: RateResult;
  cupOfficial: RateResult;
  cupInformal: RateResult;
  fetchedAt: string;
};

/** USD → MXN via open.er-api.com (free, no key, updated daily). */
async function fetchMxn(): Promise<RateResult> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const value = data?.rates?.MXN;
    if (typeof value !== "number") throw new Error("MXN rate missing");
    return {
      value,
      source: "open.er-api.com",
      updatedAt: data?.time_last_update_utc ?? null,
    };
  } catch (err) {
    return {
      value: null,
      source: "open.er-api.com",
      updatedAt: null,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

/** Official CUP rate from open.er-api.com (government-fixed ~120 CUP/USD). */
async function fetchCupOfficial(): Promise<RateResult> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const value = data?.rates?.CUP;
    if (typeof value !== "number") throw new Error("CUP rate missing");
    return {
      value,
      source: "open.er-api.com (oficial)",
      updatedAt: data?.time_last_update_utc ?? null,
    };
  } catch (err) {
    return {
      value: null,
      source: "open.er-api.com (oficial)",
      updatedAt: null,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

/**
 * Informal CUP rate from elToque (the de-facto reference for the Cuban street rate).
 * Requires ELTOQUE_TOKEN env var. If not configured, returns null with a helpful error.
 */
async function fetchCupInformal(): Promise<RateResult> {
  const token = process.env.ELTOQUE_TOKEN;
  if (!token) {
    return {
      value: null,
      source: "elToque (informal)",
      updatedAt: null,
      error: "ELTOQUE_TOKEN no configurado",
    };
  }
  try {
    // Last 2 days window to always get the most recent daily rate.
    const to = new Date();
    const from = new Date(to.getTime() - 48 * 60 * 60 * 1000);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const url = `https://tasas.eltoque.com/v1/trmi?date_from=${fmt(from)}&date_to=${fmt(to)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Response shape: { tasas: { USD: number, ECU: number, ... }, date: "..." }
    const value =
      typeof data?.tasas?.USD === "number"
        ? data.tasas.USD
        : typeof data?.USD === "number"
          ? data.USD
          : null;
    if (value == null) throw new Error("Respuesta inesperada de elToque");
    return {
      value,
      source: "elToque (informal)",
      updatedAt: data?.date ?? null,
    };
  } catch (err) {
    return {
      value: null,
      source: "elToque (informal)",
      updatedAt: null,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

export async function GET() {
  const [mxn, cupOfficial, cupInformal] = await Promise.all([
    fetchMxn(),
    fetchCupOfficial(),
    fetchCupInformal(),
  ]);

  const payload: ExchangeRatesResponse = {
    mxn,
    cupOfficial,
    cupInformal,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    headers: {
      // Edge/browser cache: 1h fresh, 24h stale-while-revalidate.
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
