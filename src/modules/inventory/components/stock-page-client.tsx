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
import { Plus, AlertTriangle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { createStockMovement } from "../actions/stock-actions";
import { MOVEMENT_TYPES, getUnitAbbreviation } from "@/lib/constants";

interface StockLevelItem {
  productId: number;
  warehouseId: number;
  currentQuantity: unknown;
  product: { name: string; minStock: unknown; maxStock: unknown; unit: string; costPrice: unknown };
  warehouse: { name: string };
}

interface MovementItem {
  movementId: number;
  quantity: unknown;
  movementType: string;
  unitCost: unknown;
  referenceDoc: string | null;
  notes: string | null;
  createdAt: Date;
  product: { name: string; unit: string };
  warehouse: { name: string };
}

interface ProductItem {
  productId: number;
  name: string;
  unit: string;
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
  const [movementType, setMovementType] = useState("entry");

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const result = await createStockMovement({
      productId: Number(fd.get("productId")),
      warehouseId: Number(fd.get("warehouseId")),
      quantity: Number(fd.get("quantity")),
      movementType: fd.get("movementType") as string,
      unitCost: fd.get("unitCost") ? Number(fd.get("unitCost")) : undefined,
      referenceDoc: (fd.get("referenceDoc") as string) || undefined,
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
    <div className="space-y-4">
      {/* Stock Levels */}
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-4 py-3 border-b flex justify-between items-center">
          <h2 className="text-base font-medium">Niveles de Stock</h2>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />Nuevo Movimiento
          </Button>
        </div>
        <div className="grid gap-4 p-4">
          {stockLevels.length > 0 ? stockLevels.map((sl) => {
            const qty = Number(sl.currentQuantity);
            const minStock = Number(sl.product.minStock);
            const maxStock = sl.product.maxStock ? Number(sl.product.maxStock) : null;
            const isLow = qty < minStock;
            const isOver = maxStock !== null && qty > maxStock;
            const abbr = getUnitAbbreviation(sl.product.unit);
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
                    {isOver && (
                      <Badge className="bg-orange-100 text-orange-800">
                        <ArrowUpCircle className="h-3 w-3 mr-1" />Sobrestock
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span>Almacen: {sl.warehouse.name}</span>
                    <span>Cantidad: {String(sl.currentQuantity)} {abbr}</span>
                    <span>Min: {String(sl.product.minStock)} {abbr}</span>
                    {maxStock !== null && <span>Max: {String(sl.product.maxStock)} {abbr}</span>}
                    {sl.product.costPrice != null && Number(sl.product.costPrice) > 0 && <span>Costo: ${String(sl.product.costPrice)}</span>}
                  </div>
                </div>
              </div>
            );
          }) : <EmptyState title="Sin stock registrado" description="Registra movimientos para ver los niveles de stock." />}
        </div>
      </div>

      {/* Recent Movements */}
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h2 className="text-base font-medium">Movimientos Recientes</h2>
        </div>
        <div className="grid gap-3 p-4">
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
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                  <span>Cantidad: {String(m.quantity)} {getUnitAbbreviation(m.product.unit)}</span>
                  {m.unitCost != null && Number(m.unitCost) > 0 && <span>Costo: ${String(m.unitCost)}/{getUnitAbbreviation(m.product.unit)}</span>}
                  {m.referenceDoc && <span>Doc: {m.referenceDoc}</span>}
                  {m.notes && <span>{m.notes}</span>}
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
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
                    <SelectItem key={p.productId} value={String(p.productId)}>
                      {p.name} ({getUnitAbbreviation(p.unit)})
                    </SelectItem>
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
                <Select name="movementType" defaultValue="entry" onValueChange={setMovementType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOVEMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {movementType === "entry" && (
              <div className="space-y-2">
                <Label>Costo unitario</Label>
                <Input name="unitCost" type="number" step="0.01" placeholder="Precio de compra por unidad" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Documento de referencia</Label>
              <Input name="referenceDoc" placeholder="No. factura, vale de salida, etc." />
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
