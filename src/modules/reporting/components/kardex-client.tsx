"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

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

const TYPE_COLORS: Record<string, string> = {
  entry: "bg-green-100 text-green-800",
  exit: "bg-red-100 text-red-800",
  transfer: "bg-blue-100 text-blue-800",
  adjustment: "bg-yellow-100 text-yellow-800",
};

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

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Producto</Label>
          <Select
            value={selectedProductId ? String(selectedProductId) : ""}
            onValueChange={(v) =>
              router.push(`/reports/kardex?${buildQs({ productId: v })}`)
            }
          >
            <SelectTrigger><SelectValue placeholder="Selecciona un producto..." /></SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.productId} value={String(p.productId)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Almacen</Label>
          <Select
            value={selectedWarehouseId ? String(selectedWarehouseId) : "all"}
            onValueChange={(v) =>
              router.push(`/reports/kardex?${buildQs({ warehouseId: v === "all" ? null : v })}`)
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los almacenes</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.warehouseId} value={String(w.warehouseId)}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedProductId ? (
        <EmptyState title="Selecciona un producto" description="Elige un producto para ver su kardex." />
      ) : rows.length === 0 ? (
        <EmptyState title="Sin movimientos" description="Este producto no tiene movimientos en el filtro actual." />
      ) : (
        <div className="bg-card border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Almacen</th>
                <th className="px-3 py-2 text-right">Entrada</th>
                <th className="px-3 py-2 text-right">Salida</th>
                <th className="px-3 py-2 text-right">Costo unit.</th>
                <th className="px-3 py-2 text-right">Saldo</th>
                <th className="px-3 py-2">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString("es-ES")}
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={TYPE_COLORS[r.movementType]}>{r.movementType}</Badge>
                  </td>
                  <td className="px-3 py-2">{r.warehouseName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.signedDelta > 0 ? r.signedDelta : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.signedDelta < 0 ? Math.abs(r.signedDelta) : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.unitCost != null ? `$${r.unitCost.toFixed(2)}` : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{r.balance}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {r.referenceDoc || r.notes || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {product && (
            <div className="px-4 py-2 border-t bg-muted/30 text-sm text-muted-foreground">
              Unidad: {product.unit}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
