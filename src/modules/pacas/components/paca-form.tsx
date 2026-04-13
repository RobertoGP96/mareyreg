"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PACA_STATUSES } from "@/lib/constants";

interface PacaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isLoading: boolean;
  categories: { categoryId: number; name: string }[];
  warehouses: { warehouseId: number; name: string }[];
  paca?: {
    code: string;
    weightKg: unknown;
    categoryId: number;
    origin: string | null;
    supplier: string | null;
    purchasePrice: unknown;
    salePrice: unknown;
    status: string;
    arrivalDate: string | null;
    notes: string | null;
    warehouseId: number | null;
  } | null;
}

export function PacaForm({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  categories,
  warehouses,
  paca,
}: PacaFormProps) {
  const isEdit = !!paca;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const warehouseVal = fd.get("warehouseId") as string;
    onSubmit({
      code: fd.get("code") as string,
      weightKg: Number(fd.get("weightKg")),
      categoryId: Number(fd.get("categoryId")),
      origin: fd.get("origin") as string || undefined,
      supplier: fd.get("supplier") as string || undefined,
      purchasePrice: fd.get("purchasePrice") ? Number(fd.get("purchasePrice")) : undefined,
      salePrice: fd.get("salePrice") ? Number(fd.get("salePrice")) : undefined,
      status: fd.get("status") as string,
      arrivalDate: fd.get("arrivalDate") as string || undefined,
      notes: fd.get("notes") as string || undefined,
      warehouseId: warehouseVal && warehouseVal !== "none" ? Number(warehouseVal) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Paca" : "Nueva Paca"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Codigo *</Label>
              <Input name="code" defaultValue={paca?.code} required />
            </div>
            <div className="space-y-2">
              <Label>Peso (kg) *</Label>
              <Input name="weightKg" type="number" step="0.01" defaultValue={paca ? String(paca.weightKg) : ""} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select name="categoryId" defaultValue={paca ? String(paca.categoryId) : undefined}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.categoryId} value={String(c.categoryId)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select name="status" defaultValue={paca?.status ?? "available"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PACA_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Origen</Label>
              <Input name="origin" defaultValue={paca?.origin ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Input name="supplier" defaultValue={paca?.supplier ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Precio compra</Label>
              <Input name="purchasePrice" type="number" step="0.01" defaultValue={paca?.purchasePrice ? String(paca.purchasePrice) : ""} />
            </div>
            <div className="space-y-2">
              <Label>Precio venta</Label>
              <Input name="salePrice" type="number" step="0.01" defaultValue={paca?.salePrice ? String(paca.salePrice) : ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de llegada</Label>
              <Input name="arrivalDate" type="date" defaultValue={paca?.arrivalDate ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Almacen</Label>
              <Select name="warehouseId" defaultValue={paca?.warehouseId ? String(paca.warehouseId) : "none"}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.warehouseId} value={String(w.warehouseId)}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea name="notes" defaultValue={paca?.notes ?? ""} />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Guardando..." : isEdit ? "Actualizar" : "Crear Paca"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
