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
