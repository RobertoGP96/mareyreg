"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { createStockMovement } from "../actions/stock-actions";
import { MOVEMENT_TYPES } from "@/lib/constants";

interface StockLevelItem {
  productId: number;
  warehouseId: number;
  currentQuantity: unknown;
  product: { name: string; minStock: unknown; unit: string };
  warehouse: { name: string };
}

interface MovementItem {
  movementId: number;
  quantity: unknown;
  movementType: string;
  notes: string | null;
  createdAt: Date;
  product: { name: string };
  warehouse: { name: string };
}

interface ProductItem {
  productId: number;
  name: string;
}

interface WarehouseItem {
  warehouseId: number;
  name: string;
}

interface Props {
  stockLevels: StockLevelItem[];
  movements: MovementItem[];
  products: ProductItem[];
  warehouses: WarehouseItem[];
}

const MOVEMENT_COLORS: Record<string, string> = {
  entry: "bg-green-100 text-green-800",
  exit: "bg-red-100 text-red-800",
  transfer: "bg-blue-100 text-blue-800",
  adjustment: "bg-yellow-100 text-yellow-800",
};

export function StockPageClient({ stockLevels, movements, products, warehouses }: Props) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const result = await createStockMovement({
      productId: Number(fd.get("productId")),
      warehouseId: Number(fd.get("warehouseId")),
      quantity: Number(fd.get("quantity")),
      movementType: fd.get("movementType") as string,
      notes: (fd.get("notes") as string) || undefined,
    });
    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      toast.success("Movimiento registrado");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const getMovementLabel = (type: string) =>
    MOVEMENT_TYPES.find((m) => m.value === type)?.label ?? type;

  return (
    <div className="space-y-6">
      {/* Stock Levels */}
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-medium">Niveles de Stock</h2>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />Nuevo Movimiento
          </Button>
        </div>
        <div className="grid gap-4 p-6">
          {stockLevels.length > 0 ? stockLevels.map((sl) => {
            const isLow = Number(sl.currentQuantity) < Number(sl.product.minStock);
            return (
              <div key={`${sl.productId}-${sl.warehouseId}`} className="bg-card border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{sl.product.name}</p>
                    {isLow && (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        <AlertTriangle className="h-3 w-3 mr-1" />Stock bajo
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Almacen: {sl.warehouse.name} | Cantidad: {String(sl.currentQuantity)} {sl.product.unit} | Min: {String(sl.product.minStock)}
                  </p>
                </div>
              </div>
            );
          }) : <EmptyState title="Sin stock registrado" description="Registra movimientos para ver los niveles de stock." />}
        </div>
      </div>

      {/* Recent Movements */}
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-medium">Movimientos Recientes</h2>
        </div>
        <div className="grid gap-3 p-6">
          {movements.length > 0 ? movements.map((m) => (
            <div key={m.movementId} className="bg-card border rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className={MOVEMENT_COLORS[m.movementType]}>
                    {getMovementLabel(m.movementType)}
                  </Badge>
                  <span className="font-medium">{m.product.name}</span>
                  <span className="text-muted-foreground">- {m.warehouse.name}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Cantidad: {String(m.quantity)} {m.notes ? `| ${m.notes}` : ""}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(m.createdAt).toLocaleDateString("es-ES")}
              </span>
            </div>
          )) : <EmptyState title="Sin movimientos" description="No se han registrado movimientos." />}
        </div>
      </div>

      {/* New Movement Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Movimiento de Stock</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Producto *</Label>
              <Select name="productId">
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.productId} value={String(p.productId)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Almacen *</Label>
              <Select name="warehouseId">
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.warehouseId} value={String(w.warehouseId)}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cantidad *</Label>
                <Input name="quantity" type="number" step="0.01" required min="0.01" />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select name="movementType" defaultValue="entry">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOVEMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input name="notes" />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Registrando..." : "Registrar Movimiento"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
