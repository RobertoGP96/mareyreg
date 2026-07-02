"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusPill, type OpsStatus } from "@/components/ui/status-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, AlertTriangle, CircleCheck, ChevronRight } from "lucide-react";

export interface OrderLogItem {
  logId: number;
  externalOrderId: string;
  status: string;
  receivedAt: string;
  apiKeyLabel: string;
  salesOrderFolio: string | null;
  invoiceFolio: string | null;
  invoiceTotal: number | null;
}

const STATUS_MAP: Record<string, { status: OpsStatus; label: string }> = {
  received: { status: "pending", label: "Recibida" },
  processed: { status: "completed", label: "Procesada" },
  needs_review: { status: "delayed", label: "Requiere revisión" },
  error: { status: "cancelled", label: "Error" },
};

export function OrderInboxClient({
  orders,
  kpis,
}: {
  orders: OrderLogItem[];
  kpis: { receivedToday: number; needsReview: number; error: number; processedToday: number };
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = orders.filter((o) => statusFilter === "all" || o.status === statusFilter);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Órdenes de la tienda en línea"
        description="Ventas recibidas desde la tienda web, con su estado de procesamiento."
        badge={`${orders.length} órdenes`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Recibidas hoy" value={kpis.receivedToday} icon={Clock} accent="info" size="compact" />
        <KpiCard label="Requieren revisión" value={kpis.needsReview} icon={AlertTriangle} accent="warning" size="compact" />
        <KpiCard label="Con error" value={kpis.error} icon={AlertTriangle} accent="danger" size="compact" />
        <KpiCard label="Procesadas hoy" value={kpis.processedToday} icon={CircleCheck} accent="success" size="compact" />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="received">Recibidas</SelectItem>
              <SelectItem value="needs_review">Requieren revisión</SelectItem>
              <SelectItem value="error">Con error</SelectItem>
              <SelectItem value="processed">Procesadas</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="brand">{filtered.length}</Badge>
        </div>

        <div className="divide-y divide-border/60">
          {filtered.length > 0 ? (
            filtered.map((o) => {
              const cfg = STATUS_MAP[o.status] ?? { status: "pending" as OpsStatus, label: o.status };
              return (
                <Link
                  key={o.logId}
                  href={`/webstore/ordenes/${o.logId}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--brand)]/[0.04]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground truncate">{o.externalOrderId}</h3>
                      <StatusPill status={cfg.status} label={cfg.label} size="sm" />
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-muted-foreground">
                      <span>{new Date(o.receivedAt).toLocaleString("es-MX")}</span>
                      <span>Vía: {o.apiKeyLabel}</span>
                      {o.salesOrderFolio && <span>Orden: {o.salesOrderFolio}</span>}
                      {o.invoiceFolio && (
                        <span className="font-mono tabular-nums">
                          {o.invoiceFolio} — ${o.invoiceTotal?.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                </Link>
              );
            })
          ) : (
            <div className="p-8">
              <EmptyState
                title="No hay órdenes"
                description="Cuando la tienda web envíe una venta, aparecerá aquí."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
