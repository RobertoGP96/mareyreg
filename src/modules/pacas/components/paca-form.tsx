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

interface EntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    categoryId: number;
    quantity: number;
    purchasePrice?: number;
    supplier?: string;
    origin?: string;
    arrivalDate?: string;
    notes?: string;
  }) => void;
  isLoading: boolean;
  categories: { categoryId: number; name: string }[];
}

export function PacaEntryForm({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  categories,
}: EntryFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      categoryId: Number(fd.get("categoryId")),
      quantity: Number(fd.get("quantity")),
      purchasePrice: fd.get("purchasePrice") ? Number(fd.get("purchasePrice")) : undefined,
      supplier: (fd.get("supplier") as string) || undefined,
      origin: (fd.get("origin") as string) || undefined,
      arrivalDate: (fd.get("arrivalDate") as string) || undefined,
      notes: (fd.get("notes") as string) || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Entrada de Pacas</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select name="categoryId" required>
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
              <Label>Cantidad *</Label>
              <Input name="quantity" type="number" min="1" required placeholder="Ej: 10" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Precio de compra (unidad)</Label>
              <Input name="purchasePrice" type="number" step="0.01" placeholder="Ej: 25.00" />
            </div>
            <div className="space-y-2">
              <Label>Fecha de llegada</Label>
              <Input name="arrivalDate" type="date" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Input name="supplier" placeholder="Nombre del proveedor" />
            </div>
            <div className="space-y-2">
              <Label>Origen</Label>
              <Input name="origin" placeholder="Pais o region" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea name="notes" placeholder="Observaciones..." />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Registrando..." : "Registrar Entrada"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
