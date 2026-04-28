import { db } from "@/lib/db";
import type { OperationRow } from "../lib/types";
import type { OperationStatus, OperationType, Prisma } from "@/generated/prisma";

export interface OperationFilter {
  accountId?: number;
  groupId?: number;
  status?: OperationStatus;
  type?: OperationType;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
  limit?: number;
}

export async function getOperations(filter: OperationFilter = {}): Promise<OperationRow[]> {
  const where: Prisma.OperationWhereInput = {};
  if (filter.accountId) where.accountId = filter.accountId;
  if (filter.status) where.status = filter.status;
  if (filter.type) where.type = filter.type;
  if (filter.groupId) where.account = { groupId: filter.groupId };
  if (filter.fromDate || filter.toDate) {
    where.occurredAt = {};
    if (filter.fromDate) where.occurredAt.gte = filter.fromDate;
    if (filter.toDate) where.occurredAt.lte = filter.toDate;
  }
  if (filter.search) {
    where.OR = [
      { description: { contains: filter.search, mode: "insensitive" } },
      { reference: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  const rows = await db.operation.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }, { operationId: "desc" }],
    take: filter.limit ?? 200,
    include: {
      account: {
        select: {
          name: true,
          accountNumber: true,
          group: { select: { name: true } },
        },
      },
      currency: { select: { code: true, symbol: true, decimalPlaces: true } },
      exchangeRateRule: { select: { ruleId: true, name: true } },
      counterCurrency: { select: { code: true, symbol: true, decimalPlaces: true } },
    },
  });

  return rows.map((o) => ({
    operationId: o.operationId,
    accountId: o.accountId,
    currencyId: o.currencyId,
    type: o.type,
    status: o.status,
    description: o.description,
    reference: o.reference,
    occurredAt: o.occurredAt,
    confirmedAt: o.confirmedAt,
    createdAt: o.createdAt,
    amount: Number(o.amount),
    balanceAfter: Number(o.balanceAfter),
    accountName: o.account.name,
    accountNumber: o.account.accountNumber,
    groupName: o.account.group.name,
    currencyCode: o.currency.code,
    currencySymbol: o.currency.symbol,
    currencyDecimals: o.currency.decimalPlaces,
    exchangeRateRuleId: o.exchangeRateRuleId,
    exchangeRateRuleName: o.exchangeRateRule?.name ?? null,
    rateApplied: o.rateApplied !== null ? Number(o.rateApplied) : null,
    counterAmount: o.counterAmount !== null ? Number(o.counterAmount) : null,
    counterCurrencyId: o.counterCurrencyId,
    counterCurrencyCode: o.counterCurrency?.code ?? null,
    counterCurrencySymbol: o.counterCurrency?.symbol ?? null,
    counterCurrencyDecimals: o.counterCurrency?.decimalPlaces ?? null,
  }));
}

export async function getOperationFormData() {
  const accounts = await db.account.findMany({
    where: { active: true },
    select: {
      accountId: true,
      accountNumber: true,
      name: true,
      balance: true,
      groupId: true,
      currencyId: true,
      group: { select: { code: true, name: true } },
      currency: { select: { code: true, symbol: true, decimalPlaces: true } },
      exchangeRateRule: {
        select: {
          ruleId: true, baseCurrencyId: true, quoteCurrencyId: true,
          baseCurrency: { select: { code: true } },
          quoteCurrency: { select: { code: true } },
        },
      },
    },
    orderBy: [{ group: { name: "asc" } }, { accountNumber: "asc" }],
  });
  return accounts.map((a) => ({
    accountId: a.accountId,
    accountNumber: a.accountNumber,
    name: a.name,
    balance: Number(a.balance),
    groupId: a.groupId,
    currencyId: a.currencyId,
    groupCode: a.group.code,
    groupName: a.group.name,
    currencyCode: a.currency.code,
    currencySymbol: a.currency.symbol,
    currencyDecimals: a.currency.decimalPlaces,
    rule: a.exchangeRateRule
      ? {
          ruleId: a.exchangeRateRule.ruleId,
          baseCurrencyId: a.exchangeRateRule.baseCurrencyId,
          quoteCurrencyId: a.exchangeRateRule.quoteCurrencyId,
          baseCurrencyCode: a.exchangeRateRule.baseCurrency.code,
          quoteCurrencyCode: a.exchangeRateRule.quoteCurrency.code,
        }
      : null,
  }));
}

export async function getAvailableBalance(accountId: number) {
  const acc = await db.account.findUniqueOrThrow({ where: { accountId } });
  const reserved = await db.operation.aggregate({
    where: {
      accountId,
      status: "pending",
      type: { in: ["withdrawal", "transfer_out"] },
    },
    _sum: { amount: true },
  });
  return {
    balance: Number(acc.balance),
    reserved: Number(reserved._sum.amount ?? 0),
    available: Number(acc.balance) - Number(reserved._sum.amount ?? 0),
  };
}

export type OperationFormAccount = Awaited<ReturnType<typeof getOperationFormData>>[number];
