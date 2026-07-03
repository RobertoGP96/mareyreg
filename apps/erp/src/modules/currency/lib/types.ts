// DTOs serializables (Decimal → number) para pasar de queries a componentes cliente.

export type CurrencyOption = {
  currencyId: number;
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
};

export type ExchangeRateRow = {
  exchangeRateId: number;
  baseCurrencyId: number;
  quoteCurrencyId: number;
  baseCurrencyCode: string;
  baseCurrencySymbol: string;
  quoteCurrencyCode: string;
  quoteCurrencySymbol: string;
  quoteDecimalPlaces: number;
  rate: number;
  version: number;
  updatedBy: number | null;
  updatedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ExchangeRateHistoryRow = {
  historyId: number;
  exchangeRateId: number;
  oldRate: number | null;
  newRate: number;
  changedBy: number | null;
  changedByName: string | null;
  changedAt: Date;
  note: string | null;
};
