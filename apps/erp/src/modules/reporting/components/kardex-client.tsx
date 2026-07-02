"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { MetricTile } from "@/components/ui/metric-tile";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Wrench,
  Package,
  Warehouse as WarehouseIcon,
  TrendingUp,
  CircleDollarSign,
} from "lucide-react";
import { MOVEMENT_TYPES, getUnitAbbreviation } from "@/lib/constants";

interface ProductOption {
  productId: number;
  name: string;
  unit: string;
}

interface WarehouseOption {
  warehouseId: number;
  name: string;
}

interface KardexRow {
  createdAt: Date;
  movementType: string;
  quantity: number;
  signedDelta: number;
  unitCost: number | null;
  referenceDoc: string | null;
  notes: string | null;
  warehouseName: string;
  balance: number;
}

interface Props {
  products: ProductOption[];
  warehouses: WarehouseOption[];
  selectedProductId: number | null;
  selectedWarehouseId: number | null;
  product: ProductOption | null;
  rows: KardexRow[];
}

const MOVEMENT_ICON: Record<string, typeof ArrowDownToLine> = {
  entry: ArrowDownToLine,
  exit: ArrowUpFromLine,
  transfer: ArrowLeftRight,
  adjustment: Wrench,
};

const MOVEMENT_BG: Record<string, string> = {
  entry: "bg-[var(--ops-success)]/10 text-[var(--ops-success)]",
  exit: "bg-[var(--ops-critical)]/10 text-[var(--ops-critical)]",
  transfer: "bg-[var(--ops-active)]/10 text-[var(--ops-active)]",
  adjustment: "bg-[var(--ops-warning)]/12 text-[var(--ops-warning)]",
};

function getMovementLabel(type: string) {
  return MOVEMENT_TYPES.find((m) => m.value === type)?.label ?? type;
}

export function KardexClient({
  products,
  warehouses,
  selectedProductId,
  selectedWarehouseId,
  product,
  rows,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const buildQs = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "all") next.delete(k);
      else next.set(k, v);
    }
    return next.toString();
  };

  const summary = useMemo(() => {
    let entries = 0;
    let exits = 0;
    let totalIn = 0;
    let totalOut = 0;
    let valueIn = 0;
    for (const r of rows) {
      if (r.signedDelta > 0) {
        entries += 1;
        totalIn += r.signedDelta;
        if (r.unitCost != null) valueIn += r.signedDelta * r.unitCost;
      } else if (r.signedDelta < 0) {
        exits += 1;
        totalOut += Math.abs(r.signedDelta);
      }
    }
    const balance = rows.length > 0 ? rows[rows.length - 1].balance : 0;
    return { entries, exits, totalIn, totalOut, valueIn, balance };
  }, [rows]);

  const abbr = product ? getUnitAbbreviation(product.unit) : "";

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="rounded-xl border border-border bg-card shadow-panel p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Producto" icon={Package}>
            <Select
              value={selectedProductId ? String(selectedProductId) : ""}
              onValueChange={(v) =>
                router.push(`/reports/kardex?${buildQs({ productId: v })}`)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un producto..." />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.productId} value={String(p.productId)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Almacén" icon={WarehouseIcon}>
            <Select
              value={selectedWarehouseId ? String(selectedWarehouseId) : "all"}
              onValueChange={(v) =>
                router.push(
                  `/reports/kardex?${buildQs({
                    warehouseId: v === "all" ? null : v,
                  })}`
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los almacenes</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.warehouseId} value={String(w.warehouseId)}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      {!selectedProductId ? (
        <EmptyState
          title="Selecciona un producto"
          description="Elige un producto para ver su kardex y resumen de movimientos."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin movimientos"
          description="Este producto no tiene movimientos en el filtro actual."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricTile
              label="Entradas"
              value={summary.totalIn.toFixed(0)}
              icon={ArrowDownToLine}
              tone="success"
              hint={`${summary.entries} mov.`}
            />
            <MetricTile
              label="Salidas"
              value={summary.totalOut.toFixed(0)}
              icon={ArrowUpFromLine}
              tone="critical"
              hint={`${summary.exits} mov.`}
            />
            <MetricTile
              label="Valor entradas"
              value={`$${summary.valueIn.toFixed(0)}`}
              icon={CircleDollarSign}
              tone="active"
            />
            <MetricTile
              label={`Saldo (${abbr})`}
              value={summary.balance.toFixed(0)}
              icon={TrendingUp}
              tone={summary.balance > 0 ? "track" : "idle"}
            />
          </div>

          <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
              <h2 className="font-headline text-sm font-semibold text-foreground">
                Histórico de movimientos
              </h2>
              <Badge variant="outline">{rows.length} movimientos</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Fecha</th>
                    <th className="px-3 py-2.5 font-medium">Tipo</th>
                    <th className="px-3 py-2.5 font-medium">Almacén</th>
                    <th className="px-3 py-2.5 font-medium text-right">
                      Entrada
                    </th>
                    <th className="px-3 py-2.5 font-medium text-right">Salida</th>
                    <th className="px-3 py-2.5 font-medium text-right">
                      Costo unit.
                    </th>
                    <th className="px-3 py-2.5 font-medium text-right">Saldo</th>
                    <th className="px-3 py-2.5 font-medium">Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const Icon = MOVEMENT_ICON[r.movementType] ?? ArrowDownToLine;
                    const bg =
                      MOVEMENT_BG[r.movementType] ?? MOVEMENT_BG.transfer;
                    return (
                      <tr
                        key={i}
                        className="border-t border-border/60 hover:bg-[var(--brand)]/[0.03]"
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleString("es-ES")}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${bg}`}
                          >
                            <Icon className="size-3" />
                            {getMovementLabel(r.movementType)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-foreground">
                          {r.warehouseName}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-mono text-[var(--ops-success)]">
                          {r.signedDelta > 0 ? r.signedDelta : ""}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-mono text-[var(--ops-critical)]">
                          {r.signedDelta < 0 ? Math.abs(r.signedDelta) : ""}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-mono text-muted-foreground">
                          {r.unitCost != null ? `$${r.unitCost.toFixed(2)}` : ""}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-mono font-semibold text-foreground">
                          {r.balance}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs truncate max-w-[200px]">
                          {r.referenceDoc || r.notes || ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {product && (
              <div className="px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
                Unidad de medida:{" "}
                <span className="font-medium text-foreground">{product.unit}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
