"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { MetricTile } from "@/components/ui/metric-tile";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type DataTableColumn } from "@/components/ui/data-table";
import {
  Wallet, ArrowLeft, ArrowRightLeft, ArrowDownLeft, ArrowUpRight,
  Calculator, MoreHorizontal, MinusCircle, Pin, BarChart3, Clock,
  CircleDollarSign, Settings2, ChevronRight, Layers, SquarePen,
  Plus, ChevronDown,
} from "lucide-react";
import { formatBounds } from "../../lib/exchange-rate";
import { CurrencyChip } from "../shared/currency-chip";
import { AmountDisplay } from "../shared/amount-display";
import { OpTypeBadge } from "../shared/op-type-badge";
import { OpStatusPill } from "../shared/op-status-pill";
import { RateChip } from "../shared/rate-chip";
import { DepositWithConversionForm } from "../operations/deposit-with-conversion-form";
import { OperationsBatchForm } from "../operations/operations-batch-form";
import { TransferForm } from "../operations/transfer-form";
import {
  SingleOperationForm,
  type SingleOpKind,
} from "../operations/single-operation-form";
import { RateCoverageBar } from "../exchange-rates/rate-coverage-bar";
import {
  AccountRuleMenuItems,
  AccountRuleDialogs,
  type RuleActionMode,
  type RuleActionState,
  type RuleSummary,
} from "./account-rule-actions";
import { AccountEditDialog } from "./account-edit-dialog";
import type { AccountDetail } from "../../queries/account-queries";
import type { AccountRow, OperationRow } from "../../lib/types";
import type { OperationFormAccount } from "../../queries/operation-queries";

type CurrencyOption = { currencyId: number; code: string; symbol: string };

interface Props {
  account: AccountDetail;
  operations: OperationRow[];
  rules: RuleSummary[];
  currencies: CurrencyOption[];
  allAccounts: OperationFormAccount[];
}

const RANGE_COLORS = [
  "border-l-sky-500",
  "border-l-emerald-500",
  "border-l-amber-500",
  "border-l-violet-500",
  "border-l-rose-500",
];

const RANGE_BG_COLORS = [
  "bg-sky-500/60 dark:bg-sky-500/50",
  "bg-emerald-500/60 dark:bg-emerald-500/50",
  "bg-amber-500/60 dark:bg-amber-500/50",
  "bg-violet-500/60 dark:bg-violet-500/50",
  "bg-rose-500/60 dark:bg-rose-500/50",
];

export function AccountDetailsClient({ account, operations, rules, currencies, allAccounts }: Props) {
  const router = useRouter();
  const [ruleAction, setRuleAction] = useState<RuleActionState>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [singleOpOpen, setSingleOpOpen] = useState(false);
  const [singleOpKind, setSingleOpKind] = useState<SingleOpKind>("deposit");

  const openSingleOp = (kind: SingleOpKind) => {
    setSingleOpKind(kind);
    setSingleOpOpen(true);
  };

  const hasRules = account.rules.length > 0;
  const transferAccounts = useMemo(() => {
    const others = allAccounts.filter((a) => a.accountId !== account.accountId);
    const current = allAccounts.find((a) => a.accountId === account.accountId);
    return current ? [current, ...others] : allAccounts;
  }, [allAccounts, account.accountId]);

  const accountRulesList: RuleSummary[] = useMemo(
    () => account.rules.map((r) => ({ ...r })),
    [account.rules],
  );

  const formAccount: OperationFormAccount = useMemo(
    () => ({
      accountId: account.accountId,
      accountNumber: account.accountNumber,
      name: account.name,
      balance: account.balance,
      allowNegativeBalance: account.allowNegativeBalance,
      groupId: account.groupId,
      currencyId: account.currencyId,
      groupCode: account.groupCode,
      groupName: account.groupName,
      currencyCode: account.currencyCode,
      currencySymbol: account.currencySymbol,
      currencyDecimals: account.currencyDecimals,
      rules: accountRulesList,
    }),
    [account, accountRulesList],
  );

  const assignedByAccount = useMemo(
    () => ({ [account.accountId]: accountRulesList }),
    [account.accountId, accountRulesList],
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
      rulesCount: accountRulesList.length,
      ruleNames: accountRulesList.map((r) => r.name),
    }),
    [account, accountRulesList],
  );

  const handleRuleAction = (mode: RuleActionMode) => {
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
        meta={
          <>
            <StatusPill status={account.active ? "active" : "inactive"} size="sm" />
            {account.allowNegativeBalance && (
              <Badge variant="warning" className="text-[10px] gap-1">
                <MinusCircle className="h-3 w-3" /> Negativo OK
              </Badge>
            )}
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              <SquarePen className="h-4 w-4" /> Editar cuenta
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="brand" size="sm">
                  <Plus className="h-4 w-4" /> Nueva operación
                  <ChevronDown className="h-3.5 w-3.5 -mr-0.5 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Movimientos simples
                </DropdownMenuLabel>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openSingleOp("deposit"); }}>
                  <ArrowDownLeft className="h-4 w-4 text-[var(--ops-success)]" />
                  <span>Depósito</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openSingleOp("withdrawal"); }}>
                  <ArrowUpRight className="h-4 w-4 text-rose-500" />
                  <span>Retiro</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openSingleOp("adjustment"); }}>
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <span>Ajuste</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Movimientos avanzados
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    if (!hasRules) {
                      toast.error("Asigna al menos una regla para habilitar la conversión.");
                      return;
                    }
                    setDepositOpen(true);
                  }}
                  disabled={!hasRules}
                >
                  <ArrowDownLeft className="h-4 w-4 text-[var(--brand)]" />
                  <span>Conversión</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    if (transferAccounts.length < 2) {
                      toast.error("Necesitas al menos otra cuenta para transferir.");
                      return;
                    }
                    setTransferOpen(true);
                  }}
                  disabled={transferAccounts.length < 2}
                >
                  <ArrowRightLeft className="h-4 w-4 text-[var(--brand)]" />
                  <span>Transferencia</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setBatchOpen(true); }}>
                  <Layers className="h-4 w-4" />
                  <span>Operaciones múltiples</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
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
              Tasa que se aplicará al transferir o convertir (crédito o débito) desde/hacia esta cuenta.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" /> Acciones
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <AccountRuleMenuItems account={accountRow} onAction={handleRuleAction} />
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {accountRulesList.length === 0 ? (
          <EmptyState
            title="Sin reglas asignadas"
            description="Asigna o crea reglas para habilitar conversiones automáticas en transferencias y depósitos."
          />
        ) : (
          (() => {
            const groups = new Map<
              string,
              {
                baseCurrencyId: number;
                quoteCurrencyId: number;
                baseCurrencyCode: string;
                quoteCurrencyCode: string;
                rules: typeof accountRulesList;
              }
            >();
            for (const r of accountRulesList) {
              const key = `${r.baseCurrencyId}-${r.quoteCurrencyId}`;
              const prev = groups.get(key);
              if (prev) prev.rules.push(r);
              else
                groups.set(key, {
                  baseCurrencyId: r.baseCurrencyId,
                  quoteCurrencyId: r.quoteCurrencyId,
                  baseCurrencyCode: r.baseCurrencyCode,
                  quoteCurrencyCode: r.quoteCurrencyCode,
                  rules: [r],
                });
            }
            return (
              <div className="space-y-4">
                {[...groups.values()].map((group) => {
                  const sortedRules = [...group.rules].sort(
                    (a, b) => a.minAmount - b.minAmount,
                  );
                  return (
                    <div
                      key={`${group.baseCurrencyId}-${group.quoteCurrencyId}`}
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <CurrencyChip code={group.baseCurrencyCode} size="sm" />
                        <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                        <CurrencyChip code={group.quoteCurrencyCode} size="sm" />
                        <Badge variant="outline" className="text-[10px]">
                          {sortedRules.length} {sortedRules.length === 1 ? "regla" : "reglas"}
                        </Badge>
                      </div>
                      <RateCoverageBar
                        rules={sortedRules.map((r, idx) => ({
                          ruleId: r.ruleId,
                          name: r.name,
                          minAmount: r.minAmount,
                          maxAmount: r.maxAmount,
                          minInclusive: r.minInclusive,
                          maxInclusive: r.maxInclusive,
                          rate: r.rate,
                          colorClass: RANGE_BG_COLORS[idx % RANGE_BG_COLORS.length],
                        }))}
                        baseCurrencyCode={group.baseCurrencyCode}
                        quoteCurrencyCode={group.quoteCurrencyCode}
                      />
                      <div className="space-y-1.5">
                        {sortedRules.map((rg, idx) => (
                          <div
                            key={rg.ruleId}
                            className={`flex items-center justify-between gap-3 rounded-md bg-muted/30 px-2.5 py-1.5 border-l-4 ${RANGE_COLORS[idx % RANGE_COLORS.length]}`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">{rg.name}</div>
                              <div className="text-[10px] font-mono tabular-nums text-muted-foreground">
                                {formatBounds(rg, (n) => n.toLocaleString("es-MX"))}
                              </div>
                            </div>
                            <span className="font-mono tabular-nums text-sm font-semibold whitespace-nowrap">
                              {rg.rate.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                {group.quoteCurrencyCode}/{group.baseCurrencyCode}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
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
        assignedByAccount={assignedByAccount}
        currencies={currencies}
      />

      <DepositWithConversionForm
        open={depositOpen}
        onOpenChange={setDepositOpen}
        accounts={[formAccount]}
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

      <SingleOperationForm
        open={singleOpOpen}
        onOpenChange={setSingleOpOpen}
        account={formAccount}
        initialKind={singleOpKind}
      />

      <TransferForm
        open={transferOpen}
        onOpenChange={setTransferOpen}
        accounts={transferAccounts}
      />

      <AccountEditDialog
        account={
          editOpen
            ? {
                accountId: account.accountId,
                name: account.name,
                accountNumber: account.accountNumber,
                allowNegativeBalance: account.allowNegativeBalance,
                groupName: account.groupName,
                currencyCode: account.currencyCode,
              }
            : null
        }
        onClose={() => setEditOpen(false)}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
