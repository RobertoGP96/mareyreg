"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { type DataTableColumn } from "@/components/ui/data-table";
import { ChevronDown, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountRow } from "../../lib/types";
import { CurrencyChip } from "../shared/currency-chip";
import { AmountDisplay } from "../shared/amount-display";

type GroupBalance = {
  code: string;
  total: number;
  decimalPlaces: number;
};

type Props = {
  groupId: number;
  groupName: string;
  groupCode: string;
  accounts: AccountRow[];
  columns: DataTableColumn<AccountRow>[];
  mobileCard: (a: AccountRow, index: number) => React.ReactNode;
  onRowClick?: (a: AccountRow) => void;
  defaultExpanded?: boolean;
};

const ALIGN = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

export function AccountGroupSection({
  groupId,
  groupName,
  groupCode,
  accounts,
  columns,
  mobileCard,
  onRowClick,
  defaultExpanded = true,
}: Props) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  React.useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const totals = React.useMemo<GroupBalance[]>(() => {
    const map = new Map<string, GroupBalance>();
    for (const a of accounts) {
      if (!a.active) continue;
      const prev = map.get(a.currencyCode);
      if (prev) prev.total += a.balance;
      else
        map.set(a.currencyCode, {
          code: a.currencyCode,
          total: a.balance,
          decimalPlaces: a.currencyDecimals,
        });
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts]);

  const headerId = `group-section-${groupId}-header`;
  const panelId = `group-section-${groupId}-panel`;

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
      <button
        type="button"
        id={headerId}
        aria-controls={panelId}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left bg-muted/40 hover:bg-muted/60 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground shrink-0 transition-transform motion-reduce:transition-none",
              !expanded && "-rotate-90"
            )}
          />
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-semibold text-sm text-foreground truncate">
            {groupName}
          </span>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground shrink-0">
            {groupCode}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground mr-1">
            <Wallet className="h-3.5 w-3.5" />
            {accounts.length}
          </span>
          {totals.map((b) => (
            <span
              key={b.code}
              className="inline-flex items-center gap-1 rounded-md bg-background px-1.5 py-0.5 ring-1 ring-inset ring-border"
            >
              <CurrencyChip code={b.code} size="sm" />
              <AmountDisplay
                value={b.total}
                decimalPlaces={b.decimalPlaces}
                signed
                size="sm"
              />
            </span>
          ))}
        </div>
      </button>

      {expanded ? (
        <div id={panelId} role="region" aria-labelledby={headerId}>
          {isMobile ? (
            <div className="flex flex-col gap-2 p-2.5">
              {accounts.map((a, i) => (
                <React.Fragment key={a.accountId}>
                  {mobileCard(a, i)}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        scope="col"
                        className={cn(
                          "px-3 py-2 border-b border-border whitespace-nowrap",
                          ALIGN[col.align ?? "left"],
                          col.width,
                          col.className
                        )}
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((row, i) => (
                    <tr
                      key={row.accountId}
                      onClick={
                        onRowClick
                          ? (e) => {
                              const t = e.target as HTMLElement;
                              if (
                                t.closest(
                                  'button, a, input, select, textarea, label, [role="menu"], [role="menuitem"], [role="dialog"], [data-no-row-click]'
                                )
                              )
                                return;
                              onRowClick(row);
                            }
                          : undefined
                      }
                      className={cn(
                        "border-b border-border/60 last:border-0 transition-colors",
                        onRowClick && "cursor-pointer hover:bg-muted/40",
                        "focus-within:bg-muted/40"
                      )}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-3 py-2 align-middle",
                            ALIGN[col.align ?? "left"],
                            col.className
                          )}
                        >
                          {col.cell(row, i)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
