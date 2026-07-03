"use client";

import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { DataTableColumn } from "@/components/ui/data-table";
import { History } from "lucide-react";
import { formatAmount } from "@/lib/format";
import type { ExchangeRateHistoryRow } from "../lib/types";

interface RateHistoryListProps {
  history: ExchangeRateHistoryRow[];
  decimalPlaces: number;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function VariationBadge({ oldRate, newRate }: { oldRate: number | null; newRate: number }) {
  if (oldRate === null || oldRate === 0) {
    return <span className="text-xs text-muted-foreground">Tasa inicial</span>;
  }
  const pct = ((newRate - oldRate) / oldRate) * 100;
  const positive = pct > 0;
  const negative = pct < 0;
  return (
    <span
      className={
        "font-mono tabular-nums text-xs font-semibold " +
        (positive ? "text-[var(--ops-success)]" : negative ? "text-destructive" : "text-muted-foreground")
      }
    >
      {formatAmount(pct, 2, { showSign: true })}%
    </span>
  );
}

export function RateHistoryList({ history, decimalPlaces }: RateHistoryListProps) {
  if (history.length === 0) {
    return (
      <EmptyState
        icon={<History className="size-10" />}
        title="Sin historial"
        description="Todavía no hay cambios registrados para esta tasa."
      />
    );
  }

  const columns: DataTableColumn<ExchangeRateHistoryRow>[] = [
    {
      key: "changedAt",
      header: "Fecha",
      cell: (row) => <span className="text-sm">{formatDate(row.changedAt)}</span>,
    },
    {
      key: "change",
      header: "Anterior → Nueva",
      cell: (row) => (
        <span className="font-mono tabular-nums text-sm">
          {row.oldRate === null ? "—" : formatAmount(row.oldRate, decimalPlaces)}
          {" → "}
          {formatAmount(row.newRate, decimalPlaces)}
        </span>
      ),
    },
    {
      key: "variation",
      header: "Variación",
      cell: (row) => <VariationBadge oldRate={row.oldRate} newRate={row.newRate} />,
    },
    {
      key: "changedByName",
      header: "Usuario",
      cell: (row) => <span className="text-sm text-muted-foreground">{row.changedByName ?? "—"}</span>,
    },
    {
      key: "note",
      header: "Nota",
      cell: (row) => <span className="text-sm text-muted-foreground truncate">{row.note ?? "—"}</span>,
    },
  ];

  return (
    <ResponsiveListView
      columns={columns}
      rows={history}
      rowKey={(row) => row.historyId}
      mobileCard={(row) => (
        <MobileListCard
          title={
            <span className="font-mono tabular-nums">
              {row.oldRate === null ? "—" : formatAmount(row.oldRate, decimalPlaces)}
              {" → "}
              {formatAmount(row.newRate, decimalPlaces)}
            </span>
          }
          subtitle={formatDate(row.changedAt)}
          value={<VariationBadge oldRate={row.oldRate} newRate={row.newRate} />}
          meta={
            <>
              {row.changedByName && (
                <span className="text-xs text-muted-foreground">{row.changedByName}</span>
              )}
              {row.note && <span className="text-xs text-muted-foreground truncate">— {row.note}</span>}
            </>
          }
        />
      )}
    />
  );
}
