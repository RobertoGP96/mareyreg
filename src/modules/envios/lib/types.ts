// DTOs serializables (Decimal → number) para pasar de queries a componentes cliente.

import type {
  Currency,
  AccountGroup,
  Account,
  ExchangeRateRule,
  ExchangeRateRange,
  Operation,
  OperationType,
  OperationStatus,
} from "@/generated/prisma";

export type CurrencyRow = Pick<
  Currency,
  "currencyId" | "code" | "name" | "symbol" | "decimalPlaces" | "active"
> & {
  accountsCount: number;
  rulesCount: number;
};

export type AccountGroupRow = Pick<
  AccountGroup,
  "groupId" | "code" | "name" | "description" | "active"
> & {
  ownerName: string | null;
  ownerEmail: string | null;
  accountsCount: number;
  balancesByCurrency: Array<{
    currencyId: number;
    code: string;
    symbol: string;
    decimalPlaces: number;
    balance: number;
  }>;
};

export type AccountRow = Pick<
  Account,
  "accountId" | "groupId" | "userId" | "currencyId" | "accountNumber" | "name" | "active" | "allowNegativeBalance"
> & {
  balance: number;
  groupName: string;
  groupCode: string;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimals: number;
  ruleId: number | null;
  ruleName: string | null;
};

export type ExchangeRateRuleRow = Pick<
  ExchangeRateRule,
  "ruleId" | "name" | "kind" | "baseCurrencyId" | "quoteCurrencyId" | "active"
> & {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  ranges: Array<{
    rangeId: number;
    minAmount: number;
    maxAmount: number | null;
    rate: number;
  }>;
};

export type OperationRow = Pick<
  Operation,
  | "operationId"
  | "accountId"
  | "currencyId"
  | "type"
  | "status"
  | "description"
  | "reference"
  | "occurredAt"
  | "confirmedAt"
  | "createdAt"
> & {
  amount: number;
  balanceAfter: number;
  accountName: string;
  accountNumber: string;
  groupName: string;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimals: number;
  exchangeRateRuleId: number | null;
  exchangeRateRuleName: string | null;
  rateApplied: number | null;
  counterAmount: number | null;
  counterCurrencyId: number | null;
  counterCurrencyCode: string | null;
  counterCurrencySymbol: string | null;
  counterCurrencyDecimals: number | null;
};

export type {
  Currency,
  AccountGroup,
  Account,
  ExchangeRateRule,
  ExchangeRateRange,
  Operation,
  OperationType,
  OperationStatus,
};
export type { RateKind } from "@/generated/prisma";
