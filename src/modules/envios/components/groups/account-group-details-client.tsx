"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { MetricTile } from "@/components/ui/metric-tile";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { type DataTableColumn } from "@/components/ui/data-table";
import {
  Users, ArrowLeft, ChevronRight, Wallet, Calculator, ArrowRightLeft,
  Settings2, CircleDollarSign, MinusCircle, ExternalLink,
} from "lucide-react";
import { CurrencyChip } from "../shared/currency-chip";
import { AmountDisplay } from "../shared/amount-display";
import { OpTypeBadge } from "../shared/op-type-badge";
import { OpStatusPill } from "../shared/op-status-pill";
import { RateChip } from "../shared/rate-chip";
import type { GroupDetail } from "../../queries/account-group-queries";
import type { OperationRow } from "../../lib/types";

type GroupAccount = GroupDetail["accounts"][number];

interface Props {
  group: GroupDetail;
  operations: OperationRow[];
}

export function AccountGroupDetailsClient({ group, operations }: Props) {
  const totalAccounts = group.accounts.length;
  const activeAccounts = group.accounts.filter((a) => a.active).length;

  const accountColumns: DataTableColumn<GroupAccount>[] = [
    {
      key: "name",
      header: "Cuenta",
      cell: (a) => (
        <Link
          href={`/envios/cuentas/${a.accountId}`}
          className="flex flex-col gap-0.5 min-w-0 group"
        >
          <span className="font-medium text-foreground truncate group-hover:text-[var(--brand)] transition-colors flex items-center gap-2">
            <CurrencyChip code={a.currencyCode} size="sm" />
            {a.name}
          </span>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">{a.accountNumber}</span>
        </Link>
      ),
    },
    {
      key: "balance",
      header: "Saldo",
      align: "right",
      cell: (a) => <AmountDisplay value={a.balance} decimalPlaces={a.currencyDecimals} signed />,
    },
    {
      key: "rule",
      header: "Reglas",
      cell: (a) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {a.rulesCount > 0 ? (
            <Badge variant="outline" className="text-[10px]">
              {a.rulesCount} {a.rulesCount === 1 ? "regla" : "reglas"}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
          {a.allowNegativeBalance && (
            <Badge variant="warning" className="text-[10px] gap-1">
              <MinusCircle className="h-3 w-3" /> Neg
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      align: "right",
      cell: (a) => <StatusPill status={a.active ? "active" : "inactive"} size="sm" />,
    },
  ];

  const opColumns: DataTableColumn<OperationRow>[] = [
    {
      key: "type",
      header: "Tipo",
      cell: (o) => <OpTypeBadge type={o.type} />,
    },
    {
      key: "account",
      header: "Cuenta",
      cell: (o) => (
        <span className="text-sm flex items-center gap-1.5">
          <CurrencyChip code={o.currencyCode} size="sm" />
          {o.accountName}
        </span>
      ),
    },
    {
      key: "when",
      header: "Fecha",
      cell: (o) => (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {new Date(o.occurredAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
          </span>
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
          <Link href="/envios/grupos">
            <ArrowLeft className="h-4 w-4" /> Grupos
          </Link>
        </Button>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium truncate">{group.name}</span>
      </div>

      <PageHeader
        icon={Users}
        title={group.name}
        description={
          group.description ??
          `Responsable: ${group.ownerName ?? group.ownerEmail ?? "—"}`
        }
        badge={group.code}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={group.active ? "active" : "inactive"} size="sm" />
          <Badge variant="outline" className="text-[10px]">
            {totalAccounts} cuenta{totalAccounts !== 1 ? "s" : ""}
          </Badge>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <MetricTile icon={Wallet} label="Cuentas activas" value={activeAccounts} tone="active" />
        <MetricTile icon={CircleDollarSign} label="Monedas" value={group.balancesByCurrency.length} tone="track" />
        <MetricTile icon={Calculator} label="Reglas usadas" value={group.rulesUsed.length} tone="success" />
        <MetricTile icon={Settings2} label="Operaciones recientes" value={operations.length} tone="idle" />
      </div>

      {(group.balancesByCurrency.length > 0 || group.rulesUsed.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {group.balancesByCurrency.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4 shadow-panel space-y-2.5">
              <header>
                <h2 className="text-sm font-semibold font-headline flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4 text-[var(--brand)]" /> Saldos por moneda
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Suma de saldos de las cuentas activas, agrupada por moneda.
                </p>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {group.balancesByCurrency.map((b) => (
                  <div
                    key={b.currencyId}
                    className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-1.5 ring-1 ring-inset ring-border"
                  >
                    <span className="flex items-center gap-2">
                      <CurrencyChip code={b.code} size="sm" />
                      <span className="text-xs text-muted-foreground">
                        {b.accounts} cuenta{b.accounts !== 1 ? "s" : ""}
                      </span>
                    </span>
                    <AmountDisplay value={b.balance} decimalPlaces={b.decimalPlaces} signed />
                  </div>
                ))}
              </div>
            </section>
          )}

          {group.rulesUsed.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4 shadow-panel space-y-2.5">
              <header>
                <h2 className="text-sm font-semibold font-headline flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-[var(--brand)]" /> Reglas usadas
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reglas asignadas a las cuentas de este grupo.
                </p>
              </header>
              <div className="grid grid-cols-1 gap-2">
                {group.rulesUsed.map((r) => (
                  <Link
                    key={r.ruleId}
                    href="/envios/tasas"
                    className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-1.5 ring-1 ring-inset ring-border hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-medium truncate group-hover:text-[var(--brand)] transition-colors">
                        {r.name}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CurrencyChip code={r.baseCurrencyCode} size="sm" />
                        <ArrowRightLeft className="h-3 w-3" />
                        <CurrencyChip code={r.quoteCurrencyCode} size="sm" />
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {r.accountsUsing} uso{r.accountsUsing !== 1 ? "s" : ""}
                      </Badge>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <section className="space-y-2.5">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold font-headline flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[var(--brand)]" /> Cuentas
            <Badge variant="outline" className="text-[10px]">{totalAccounts}</Badge>
          </h2>
        </header>
        <ResponsiveListView<GroupAccount>
          columns={accountColumns}
          rows={group.accounts}
          rowKey={(a) => a.accountId}
          mobileCard={(a) => (
            <MobileListCard
              key={a.accountId}
              onClick={() => { window.location.href = `/envios/cuentas/${a.accountId}`; }}
              title={
                <span className="flex items-center gap-2">
                  <CurrencyChip code={a.currencyCode} size="sm" />
                  <span className="truncate font-medium">{a.name}</span>
                </span>
              }
              subtitle={a.accountNumber}
              value={
                <AmountDisplay value={a.balance} decimalPlaces={a.currencyDecimals} signed />
              }
              meta={
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill status={a.active ? "active" : "inactive"} size="sm" />
                  {a.rulesCount > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {a.rulesCount} {a.rulesCount === 1 ? "regla" : "reglas"}
                    </Badge>
                  )}
                </div>
              }
            />
          )}
          emptyState={
            <EmptyState
              title="Sin cuentas"
              description="Agrega cuentas a este grupo para empezar a operar."
            >
              <Button variant="brand" asChild>
                <Link href="/envios/cuentas">
                  <Wallet className="h-4 w-4" /> Ir a cuentas
                </Link>
              </Button>
            </EmptyState>
          }
        />
      </section>

      <section className="space-y-2.5">
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold font-headline flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-[var(--brand)]" /> Operaciones recientes del grupo
            <Badge variant="outline" className="text-[10px]">{operations.length}</Badge>
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/envios/operaciones">Ver todas</Link>
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
                subtitle={`${o.accountName} · ${new Date(o.occurredAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}`}
                value={
                  <AmountDisplay
                    value={isOut ? -o.amount : o.amount}
                    decimalPlaces={o.currencyDecimals}
                    signed
                  />
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
              description="Aún no se han registrado operaciones en cuentas de este grupo."
            />
          }
        />
      </section>
    </div>
  );
}
