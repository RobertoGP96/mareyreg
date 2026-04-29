import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";

export class RateNotConfiguredError extends Error {
  readonly amount: number;
  readonly accountId: number;
  readonly baseCurrencyId: number;
  readonly quoteCurrencyId: number;
  constructor(args: {
    accountId: number;
    baseCurrencyId: number;
    quoteCurrencyId: number;
    amount: number;
    message?: string;
  }) {
    super(
      args.message ??
        `Sin tasa configurada para monto ${args.amount} en la cuenta ${args.accountId}`,
    );
    this.name = "RateNotConfiguredError";
    this.amount = args.amount;
    this.accountId = args.accountId;
    this.baseCurrencyId = args.baseCurrencyId;
    this.quoteCurrencyId = args.quoteCurrencyId;
  }
}

export class RateOverlapError extends Error {
  constructor(message = "Múltiples reglas cubren el mismo monto") {
    super(message);
    this.name = "RateOverlapError";
  }
}

type Tx = Prisma.TransactionClient | typeof db;

export type ResolvedRate = {
  rate: number;
  ruleId: number;
  minAmount: number;
  maxAmount: number | null;
};

export type ResolveRateInput = {
  accountId: number;
  baseCurrencyId: number;
  quoteCurrencyId: number;
  amount: number;
};

/**
 * Busca, entre las reglas activas asignadas a la cuenta para el par
 * (base, quote), aquella cuyo rango `[minAmount, maxAmount)` contiene `amount`.
 * Lanza RateNotConfiguredError si ninguna cubre el monto, o RateOverlapError
 * si más de una lo cubre (no debería ocurrir con triggers anti-solape).
 */
export async function resolveRate(
  client: Tx,
  input: ResolveRateInput,
): Promise<ResolvedRate> {
  const links = await client.accountExchangeRateRule.findMany({
    where: {
      accountId: input.accountId,
      rule: {
        active: true,
        baseCurrencyId: input.baseCurrencyId,
        quoteCurrencyId: input.quoteCurrencyId,
      },
    },
    include: { rule: true },
    orderBy: { rule: { minAmount: "asc" } },
  });

  const matches = links.filter((link) => {
    const min = Number(link.rule.minAmount);
    const max = link.rule.maxAmount === null ? null : Number(link.rule.maxAmount);
    return input.amount >= min && (max === null || input.amount < max);
  });

  if (matches.length === 0) {
    throw new RateNotConfiguredError({
      accountId: input.accountId,
      baseCurrencyId: input.baseCurrencyId,
      quoteCurrencyId: input.quoteCurrencyId,
      amount: input.amount,
    });
  }
  if (matches.length > 1) {
    throw new RateOverlapError(
      `Reglas solapadas: ${matches.map((m) => m.rule.ruleId).join(", ")}`,
    );
  }

  const { rule } = matches[0];
  return {
    rate: Number(rule.rate),
    ruleId: rule.ruleId,
    minAmount: Number(rule.minAmount),
    maxAmount: rule.maxAmount === null ? null : Number(rule.maxAmount),
  };
}

export function convert(amount: number, rate: number): number {
  return amount * rate;
}

export type ConversionDirection = "base_to_quote" | "quote_to_base";

export type ResolvedConversion = ResolvedRate & {
  direction: ConversionDirection;
  baseCurrencyId: number;
  quoteCurrencyId: number;
  ruleName: string;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  amountInAccountCurrency: number;
};

/**
 * Dado una cuenta y una moneda externa, detecta la dirección de conversión
 * (base_to_quote o quote_to_base) según las reglas asignadas y resuelve la
 * tasa para `externalAmount`.
 *
 * - Si la regla cubre `external→cuenta` (base=external, quote=cuenta): multiplica.
 * - Si la regla cubre `cuenta→external` (base=cuenta, quote=external): divide.
 *
 * Lanza RateNotConfiguredError si no hay regla que cubra el monto en ninguna
 * de las dos direcciones.
 */
export async function resolveAccountConversion(
  client: Tx,
  args: {
    accountId: number;
    accountCurrencyId: number;
    externalCurrencyId: number;
    externalAmount: number;
  },
): Promise<ResolvedConversion> {
  const links = await client.accountExchangeRateRule.findMany({
    where: {
      accountId: args.accountId,
      rule: {
        active: true,
        OR: [
          { baseCurrencyId: args.externalCurrencyId, quoteCurrencyId: args.accountCurrencyId },
          { baseCurrencyId: args.accountCurrencyId, quoteCurrencyId: args.externalCurrencyId },
        ],
      },
    },
    include: { rule: { include: { baseCurrency: true, quoteCurrency: true } } },
    orderBy: { rule: { minAmount: "asc" } },
  });

  if (links.length === 0) {
    throw new RateNotConfiguredError({
      accountId: args.accountId,
      baseCurrencyId: args.externalCurrencyId,
      quoteCurrencyId: args.accountCurrencyId,
      amount: args.externalAmount,
      message: `La cuenta no tiene reglas para convertir entre estas monedas`,
    });
  }

  const matches = links.filter((link) => {
    const min = Number(link.rule.minAmount);
    const max = link.rule.maxAmount === null ? null : Number(link.rule.maxAmount);
    return args.externalAmount >= min && (max === null || args.externalAmount < max);
  });

  if (matches.length === 0) {
    throw new RateNotConfiguredError({
      accountId: args.accountId,
      baseCurrencyId: args.externalCurrencyId,
      quoteCurrencyId: args.accountCurrencyId,
      amount: args.externalAmount,
    });
  }
  if (matches.length > 1) {
    throw new RateOverlapError(
      `Reglas solapadas para monto ${args.externalAmount}: ${matches.map((m) => m.rule.ruleId).join(", ")}`,
    );
  }

  const { rule } = matches[0];
  const rate = Number(rule.rate);
  const direction: ConversionDirection =
    rule.baseCurrencyId === args.externalCurrencyId ? "base_to_quote" : "quote_to_base";
  const amountInAccountCurrency =
    direction === "base_to_quote" ? args.externalAmount * rate : args.externalAmount / rate;

  return {
    rate,
    ruleId: rule.ruleId,
    minAmount: Number(rule.minAmount),
    maxAmount: rule.maxAmount === null ? null : Number(rule.maxAmount),
    direction,
    baseCurrencyId: rule.baseCurrencyId,
    quoteCurrencyId: rule.quoteCurrencyId,
    ruleName: rule.name,
    baseCurrencyCode: rule.baseCurrency.code,
    quoteCurrencyCode: rule.quoteCurrency.code,
    amountInAccountCurrency,
  };
}

export type CoverageGap = { from: string; to: string | null };

export type CoverageReport = {
  covered: boolean;
  gaps: CoverageGap[];
  segments: Array<{ ruleId: number; from: string; to: string | null; rate: string; name: string }>;
};

/**
 * Calcula la cobertura del espectro [0, ∞) por las reglas activas asignadas a
 * una cuenta para el par (base, quote). Retorna gaps si los hay.
 */
export async function computeAccountRateCoverage(
  client: Tx,
  args: { accountId: number; baseCurrencyId: number; quoteCurrencyId: number },
): Promise<CoverageReport> {
  const links = await client.accountExchangeRateRule.findMany({
    where: {
      accountId: args.accountId,
      rule: {
        active: true,
        baseCurrencyId: args.baseCurrencyId,
        quoteCurrencyId: args.quoteCurrencyId,
      },
    },
    include: { rule: true },
    orderBy: { rule: { minAmount: "asc" } },
  });

  const segments = links.map((l) => ({
    ruleId: l.rule.ruleId,
    name: l.rule.name,
    from: l.rule.minAmount.toString(),
    to: l.rule.maxAmount === null ? null : l.rule.maxAmount.toString(),
    rate: l.rule.rate.toString(),
  }));

  if (segments.length === 0) {
    return { covered: false, gaps: [{ from: "0", to: null }], segments };
  }

  const gaps: CoverageGap[] = [];
  let cursor: number | null = 0;

  for (const seg of segments) {
    const segMin = Number(seg.from);
    const segMax = seg.to === null ? null : Number(seg.to);

    if (cursor === null) break; // ya cubrió hasta ∞

    if (segMin > cursor) {
      gaps.push({ from: String(cursor), to: String(segMin) });
    }

    if (segMax === null) {
      cursor = null;
    } else if (segMax > cursor) {
      cursor = segMax;
    }
  }

  if (cursor !== null) {
    gaps.push({ from: String(cursor), to: null });
  }

  return { covered: gaps.length === 0, gaps, segments };
}
