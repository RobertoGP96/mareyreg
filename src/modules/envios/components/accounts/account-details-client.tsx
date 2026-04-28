"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { MetricTile } from "@/components/ui/metric-tile";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type DataTableColumn } from "@/components/ui/data-table";
import {
  Wallet, ArrowLeft, ArrowRightLeft, ArrowDownLeft, ArrowUpRight,
  Calculator, MoreHorizontal, MinusCircle, Pin, BarChart3, Clock,
  CircleDollarSign, Settings2, ChevronRight, Layers,
} from "lucide-react";
import { CurrencyChip } from "../shared/currency-chip";
import { AmountDisplay } from "../shared/amount-display";
import { OpTypeBadge } from "../shared/op-type-badge";
import { OpStatusPill } from "../shared/op-status-pill";
import { RateChip } from "../shared/rate-chip";
import { DepositWithConversionForm } from "../operations/deposit-with-conversion-form";
import { OperationsBatchForm } from "../operations/operations-batch-form";
import {
  AccountRuleMenuItems,
  AccountRuleDialogs,
  removeRuleFromAccount,
  type RuleActionState,
  type RuleWithRanges,
} from "./account-rule-actions";
import type { AccountDetail } from "../../queries/account-queries";
import type { AccountRow, OperationRow } from "../../lib/types";
import type { OperationFormAccount } from "../../queries/operation-queries";

type CurrencyOption = { currencyId: number; code: string; symbol: string };

interface Props {
  account: AccountDetail;
  operations: OperationRow[];
  rules: RuleWithRanges[];
  currencies: CurrencyOption[];
}

const RANGE_COLORS = [
  "border-l-sky-500",
  "border-l-emerald-500",
  "border-l-amber-500",
  "border-l-violet-500",
  "border-l-rose-500",
];

export function AccountDetailsClient({ account, operations, rules, currencies }: Props) {
  const router = useRouter();
  const [ruleAction, setRuleAction] = useState<RuleActionState>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);

  const formAccount: OperationFormAccount = useMemo(
    () => ({
      accountId: account.accountId,
      accountNumber: account.accountNumber,
      name: account.name,
      balance: account.balance,
      groupId: account.groupId,
      currencyId: account.currencyId,
      groupCode: account.groupCode,
      groupName: account.groupName,
      currencyCode: account.currencyCode,
      currencySymbol: account.currencySymbol,
      currencyDecimals: account.currencyDecimals,
      rule: account.rule
        ? {
            ruleId: account.rule.ruleId,
            baseCurrencyId: account.rule.baseCurrencyId,
            quoteCurrencyId: account.rule.quoteCurrencyId,
            baseCurrencyCode: account.rule.baseCurrencyCode,
            quoteCurrencyCode: account.rule.quoteCurrencyCode,
          }
        : null,
    }),
    [account]
  );

  const accountRules = useMemo(
    () => ({
      [account.accountId]: account.rule
        ? {
            ruleId: account.rule.ruleId,
            baseCurrencyId: account.rule.baseCurrencyId,
            quoteCurrencyId: account.rule.quoteCurrencyId,
            baseCurrencyCode: account.rule.baseCurrencyCode,
            quoteCurrencyCode: account.rule.quoteCurrencyCode,
          }
        : null,
    }),
    [account]
  );

  const accountRow: AccountRow = useMemo(
    () => ({
      accountId: account.accountId,
      groupId: account.groupId,
      userId: 0,
      currencyId: account.currencyId,
      accountNumber: account.accountNumber,
      name: account.name,
      active: account.active,
      allowNegativeBalance: account.allowNegativeBalance,
      balance: account.balance,
      groupName: account.groupName,
      groupCode: account.groupCode,
      currencyCode: account.currencyCode,
      currencySymbol: account.currencySymbol,
      currencyDecimals: account.currencyDecimals,
      ruleId: account.rule?.ruleId ?? null,
      ruleName: account.rule?.name ?? null,
    }),
    [account]
  );

  const handleRuleAction = (mode: "assign" | "create" | "edit" | "remove") => {
    if (mode === "remove") {
      void removeRuleFromAccount(account.accountId).then((ok) => { if (ok) router.refresh(); });
      return;
    }
    setRuleAction({ account: accountRow, mode });
  };

  const opColumns: DataTableColumn<OperationRow>[] = [
    {
      key: "type",
      header: "Tipo",
      cell: (o) => <OpTypeBadge type={o.type} />,
    },
    {
      key: "when",
      header: "Fecha",
      cell: (o) => (
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-foreground">
            {new Date(o.occurredAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
          </span>
          {o.description && (
            <span className="text-muted-foreground truncate max-w-[200px]">{o.description}</span>
          )}
          {o.rateApplied != null && (
            <RateChip
              rate={o.rateApplied}
              counterAmount={o.counterAmount}
              counterCurrencyCode={o.counterCurrencyCode}
              counterCurrencyDecimals={o.counterCurrencyDecimals}
              ruleName={o.exchangeRateRuleName}
            />
          )}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Monto",
      align: "right",
      cell: (o) => {
        const isOut = o.type === "withdrawal" || o.type === "transfer_out";
        return (
          <AmountDisplay
            value={isOut ? -o.amount : o.amount}
            decimalPlaces={o.currencyDecimals}
            signed
          />
        );
      },
    },
    {
      key: "balance",
      header: "Saldo",
      align: "right",
      cell: (o) => (
        <AmountDisplay value={o.balanceAfter} decimalPlaces={o.currencyDecimals} />
      ),
    },
    {
      key: "status",
      header: "Estado",
      align: "right",
      cell: (o) => <OpStatusPill status={o.status} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/envios/cuentas">
            <ArrowLeft className="h-4 w-4" /> Cuentas
          </Link>
        </Button>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <Link
          href={`/envios/grupos/${account.groupId}`}
          className="text-muted-foreground hover:text-foreground transition-colors truncate"
        >
          {account.groupName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium truncate">{account.name}</span>
      </div>

      <PageHeader
        icon={Wallet}
        title={account.name}
        description={`${account.groupName} · ${account.accountNumber}`}
        badge={account.currencyCode}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={account.active ? "active" : "inactive"} size="sm" />
          {account.allowNegativeBalance && (
            <Badge variant="warning" className="text-[10px] gap-1">
              <MinusCircle className="h-3 w-3" /> Negativo OK
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBatchOpen(true)}
          >
            <Layers className="h-4 w-4" /> Operaciones en lote
          </Button>
          <Button
            variant="brand"
            size="sm"
            onClick={() => setDepositOpen(true)}
            disabled={!account.rule}
            title={account.rule ? undefined : "Asigna una regla a la cuenta para habilitar el depósito con conversión"}
          >
            <ArrowDownLeft className="h-4 w-4" /> Depósito con conversión
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <MetricTile
          icon={CircleDollarSign}
          label="Saldo actual"
          value={account.balance.toLocaleString("es-MX", {
            minimumFractionDigits: account.currencyDecimals,
            maximumFractionDigits: account.currencyDecimals,
          })}
          tone={account.balance >= 0 ? "active" : "critical"}
        />
        <MetricTile
          icon={ArrowDownLeft}
          label="Ingresos 30 días"
          value={account.kpis.inflows30d.toLocaleString("es-MX", {
            minimumFractionDigits: account.currencyDecimals,
            maximumFractionDigits: account.currencyDecimals,
          })}
          tone="success"
        />
        <MetricTile
          icon={ArrowUpRight}
          label="Egresos 30 días"
          value={account.kpis.outflows30d.toLocaleString("es-MX", {
            minimumFractionDigits: account.currencyDecimals,
            maximumFractionDigits: account.currencyDecimals,
          })}
          tone="warning"
        />
        <MetricTile
          icon={Clock}
          label="Operaciones pendientes"
          value={account.kpis.pending}
          tone={account.kpis.pending > 0 ? "track" : "idle"}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-4 shadow-panel space-y-3">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold font-headline flex items-center gap-2">
              <Calculator className="h-4 w-4 text-[var(--brand)]" /> Regla de tasa
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tasa que se aplicará al transferir o depositar con conversión desde/hacia esta cuenta.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" /> Acciones
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <AccountRuleMenuItems
                account={accountRow}
                rules={rules}
                onAction={handleRuleAction}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {account.rule ? (
          (() => {
            const rule = account.rule;
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{rule.name}</span>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    {rule.kind === "fixed" ? (
                      <><Pin className="h-3 w-3" /> Fija</>
                    ) : (
                      <><BarChart3 className="h-3 w-3" /> Por rangos</>
                    )}
                  </Badge>
                  <div className="flex items-center gap-1 text-sm">
                    <CurrencyChip code={rule.baseCurrencyCode} size="sm" />
                    <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                    <CurrencyChip code={rule.quoteCurrencyCode} size="sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  {rule.kind === "fixed" ? (
                    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 ring-1 ring-inset ring-[var(--ops-active)]/20">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Pin className="h-3.5 w-3.5" /> Cualquier monto
                      </span>
                      <span className="font-mono tabular-nums text-base font-semibold">
                        {rule.ranges[0]?.rate.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          {rule.quoteCurrencyCode}/{rule.baseCurrencyCode}
                        </span>
                      </span>
                    </div>
                  ) : (
                    rule.ranges.map((rg, idx) => (
                      <div
                        key={rg.rangeId}
                        className={`flex items-center justify-between gap-3 rounded-md bg-muted/30 px-2.5 py-1.5 border-l-4 ${RANGE_COLORS[idx % RANGE_COLORS.length]}`}
                      >
                        <span className="font-mono tabular-nums text-xs text-muted-foreground">
                          {rg.minAmount.toLocaleString("es-MX")} – {rg.maxAmount === null ? "∞" : rg.maxAmount.toLocaleString("es-MX")}
                        </span>
                        <span className="font-mono tabular-nums text-sm font-semibold">
                          {rg.rate.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            {rule.quoteCurrencyCode}/{rule.baseCurrencyCode}
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          <EmptyState
            title="Sin regla asignada"
            description="Asigna una regla existente o crea una nueva para habilitar conversiones automáticas en transferencias y depósitos."
          />
        )}
      </section>

      <section className="space-y-2.5">
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold font-headline flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-[var(--brand)]" /> Operaciones recientes
            <Badge variant="outline" className="text-[10px]">{operations.length}</Badge>
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link href={`/envios/operaciones?account=${account.accountId}`}>
              Ver todas
            </Link>
          </Button>
        </header>

        <ResponsiveListView<OperationRow>
          columns={opColumns}
          rows={operations}
          rowKey={(o) => o.operationId}
          mobileCard={(o) => {
            const isOut = o.type === "withdrawal" || o.type === "transfer_out";
            return (
              <MobileListCard
                key={o.operationId}
                title={
                  <span className="flex items-center gap-2">
                    <OpTypeBadge type={o.type} />
                    <OpStatusPill status={o.status} />
                  </span>
                }
                subtitle={
                  o.description ||
                  new Date(o.occurredAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
                }
                value={
                  <div className="flex flex-col items-end">
                    <AmountDisplay
                      value={isOut ? -o.amount : o.amount}
                      decimalPlaces={o.currencyDecimals}
                      signed
                    />
                    <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                      Saldo {o.balanceAfter.toLocaleString("es-MX", {
                        minimumFractionDigits: o.currencyDecimals,
                        maximumFractionDigits: o.currencyDecimals,
                      })}
                    </span>
                  </div>
                }
                meta={
                  o.rateApplied != null ? (
                    <RateChip
                      rate={o.rateApplied}
                      counterAmount={o.counterAmount}
                      counterCurrencyCode={o.counterCurrencyCode}
                      counterCurrencyDecimals={o.counterCurrencyDecimals}
                      ruleName={o.exchangeRateRuleName}
                    />
                  ) : undefined
                }
              />
            );
          }}
          emptyState={
            <EmptyState
              title="Sin operaciones"
              description="Aún no se han registrado operaciones en esta cuenta."
            />
          }
        />
      </section>

      <AccountRuleDialogs
        state={ruleAction}
        onClose={() => setRuleAction(null)}
        rules={rules}
        currencies={currencies}
      />

      <DepositWithConversionForm
        open={depositOpen}
        onOpenChange={setDepositOpen}
        accounts={[formAccount]}
        accountRules={accountRules}
        currencies={currencies}
        presetAccountId={account.accountId}
      />

      <OperationsBatchForm
        open={batchOpen}
        onOpenChange={setBatchOpen}
        accounts={[formAccount]}
        currencies={currencies}
        presetAccountId={account.accountId}
        lockAccount
      />
    </div>
  );
}
