"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import {
  Package2,
  Hash,
  FolderTree,
  CircleDollarSign,
  CalendarDays,
  Store,
  Globe,
  NotebookPen,
  Loader2,
} from "lucide-react";

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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <FormDialogHeader
              icon={Package2}
              title="Registrar entrada de pacas"
              description="Añade pacas al inventario indicando categoría y cantidad."
            />
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <FormSection icon={FolderTree} title="Clasificación" description="Categoría y cantidad recibida.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Categoría" icon={FolderTree} required>
                <Select name="categoryId" required>
                  <SelectTrigger className="w-full">
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
              </Field>
              <Field label="Cantidad" icon={Hash} required>
                <Input name="quantity" type="number" min="1" required placeholder="Ej. 10" />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={CircleDollarSign} title="Datos comerciales" description="Costo y detalles de llegada.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Precio de compra (unidad)" icon={CircleDollarSign}>
                <Input name="purchasePrice" type="number" step="0.01" placeholder="Ej. 25.00" />
              </Field>
              <Field label="Fecha de llegada" icon={CalendarDays}>
                <Input name="arrivalDate" type="date" />
              </Field>
              <Field label="Proveedor" icon={Store}>
                <Input name="supplier" placeholder="Nombre del proveedor" />
              </Field>
              <Field label="Origen" icon={Globe}>
                <Input name="origin" placeholder="País o región" />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={NotebookPen} title="Notas" description="Observaciones adicionales (opcional).">
            <Textarea name="notes" placeholder="Observaciones, defectos visibles, estado general…" />
          </FormSection>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Registrando..." : "Registrar entrada"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
