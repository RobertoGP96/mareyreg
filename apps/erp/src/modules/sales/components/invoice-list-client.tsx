"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Search, FileText } from "lucide-react";

interface InvoiceItem {
  invoiceId: number;
  folio: string;
  status: string;
  channel: string;
  issueDate: Date;
  dueDate: Date | null;
  total: unknown;
  paid: unknown;
  customer: { name: string; taxId: string | null };
  _count: { lines: number; payments: number };
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  partial: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function InvoiceListClient({ invoices }: { invoices: InvoiceItem[] }) {
  const [search, setSearch] = useState("");
  const filtered = invoices.filter(
    (i) =>
      i.folio.toLowerCase().includes(search.toLowerCase()) ||
      i.customer.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <InputGroup className="max-w-sm">
          <InputGroupAddon><Search className="w-4 h-4" /></InputGroupAddon>
          <InputGroupInput
            placeholder="Buscar factura o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>
      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <EmptyState title="Sin facturas" description="Crea facturas desde POS o desde una orden de venta." />
        ) : (
          filtered.map((i) => {
            const balance = Number(i.total) - Number(i.paid);
            return (
              <div
                key={i.invoiceId}
                className="bg-card border rounded-lg p-4 flex flex-wrap items-start gap-3 justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <Link href={`/invoices/${i.invoiceId}`} className="font-medium hover:underline">
                      {i.folio}
                    </Link>
                    <Badge className={STATUS_COLORS[i.status]}>{i.status}</Badge>
                    <Badge variant="outline">{i.channel.toUpperCase()}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>Cliente: {i.customer.name}</span>
                    <span>Fecha: {new Date(i.issueDate).toLocaleDateString("es-ES")}</span>
                    {i.dueDate && <span>Vence: {new Date(i.dueDate).toLocaleDateString("es-ES")}</span>}
                    <span>Total: ${String(i.total)}</span>
                    <span>Pagado: ${String(i.paid)}</span>
                    {balance > 0 && <span className="text-yellow-700">Pendiente: ${balance.toFixed(2)}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
