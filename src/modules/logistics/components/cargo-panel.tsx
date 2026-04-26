"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import {
  Package,
  Plus,
  Weight,
  Trash2,
  Loader2,
  Layers,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { CARGO_TYPES, PRODUCTS } from "@/lib/constants";
import type { CargoType } from "@/generated/prisma";
import { createCargo, deleteCargo } from "../actions/cargo-actions";

export interface CargoRow {
  cargoId: number;
  productName: string;
  weightKg: number | null;
  cargoType: CargoType;
  description: string | null;
}

interface Props {
  tripId: number;
  cargos: CargoRow[];
}

const CARGO_LABEL: Record<CargoType, string> = {
  bulk: "A granel",
  container: "Contenedor",
  refrigerated: "Refrigerado",
  general: "General",
};

export function CargoPanel({ tripId, cargos }: Props) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: number; label: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [productName, setProductName] = useState("");
  const [weight, setWeight] = useState("");
  const [cargoType, setCargoType] = useState<CargoType>("general");
  const [description, setDescription] = useState("");

  const totalKg = cargos.reduce((acc, c) => acc + (c.weightKg ?? 0), 0);

  const resetForm = () => {
    setProductName("");
    setWeight("");
    setCargoType("general");
    setDescription("");
  };

  const handleCreate = async () => {
    if (!productName.trim()) {
      toast.error("Selecciona o escribe un producto");
      return;
    }
    setSubmitting(true);
    const r = await createCargo({
      trip_id: tripId,
      product_name: productName.trim(),
      weight_kg: weight ? Number(weight) : null,
      cargo_type: cargoType,
      description: description.trim() || null,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Carga agregada");
      setIsFormOpen(false);
      resetForm();
      router.refresh();
    } else toast.error(r.error);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setSubmitting(true);
    const r = await deleteCargo(toDelete.id, tripId);
    setSubmitting(false);
    if (r.success) {
      toast.success("Carga eliminada");
      setToDelete(null);
      router.refresh();
    } else toast.error(r.error);
  };

  return (
    <div className="cockpit-panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-[var(--brand)]" />
          <h3 className="font-headline text-sm font-semibold">Cargas</h3>
          <Badge variant="brand">{cargos.length}</Badge>
          {totalKg > 0 && (
            <Badge variant="outline" className="font-mono tabular-nums">
              {totalKg.toFixed(1)} kg
            </Badge>
          )}
        </div>
        <Button variant="brand" size="sm" onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </div>

      {cargos.length === 0 ? (
        <div className="p-8">
          <EmptyState
            title="Sin cargas registradas"
            description="Agrega los items que se transportan en este viaje."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {cargos.map((c) => (
            <li key={c.cargoId} className="group flex items-center gap-3 px-4 py-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-muted/60 shrink-0">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground truncate">{c.productName}</span>
                  <Badge variant="outline" className="text-xs">
                    {CARGO_LABEL[c.cargoType]}
                  </Badge>
                  {c.weightKg != null && (
                    <span className="font-mono tabular-nums text-xs text-muted-foreground">
                      {c.weightKg} kg
                    </span>
                  )}
                </div>
                {c.description && (
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {c.description}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive opacity-60 group-hover:opacity-100"
                onClick={() => setToDelete({ id: c.cargoId, label: c.productName })}
                aria-label="Eliminar carga"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={isFormOpen}
        onOpenChange={(o) => {
          setIsFormOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <FormDialogHeader
              icon={Package}
              title="Agregar carga"
              description="Registra el producto, peso y tipo de carga."
            />
          </DialogHeader>
          <div className="space-y-4">
            <FormSection icon={Package} title="Producto" description="Selecciona uno conocido o escribe uno nuevo.">
              <Field label="Producto" icon={Package} required>
                <Select value={productName} onValueChange={setProductName}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCTS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="O escribir manualmente" hint="Si no aparece en la lista.">
                <Input
                  placeholder="Nombre del producto"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </Field>
            </FormSection>

            <FormSection icon={Layers} title="Detalles">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Peso (kg)" icon={Weight}>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                </Field>
                <Field label="Tipo" icon={Layers}>
                  <Select value={cargoType} onValueChange={(v) => setCargoType(v as CargoType)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARGO_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Notas" icon={FileText}>
                <Textarea
                  rows={2}
                  placeholder="Observaciones (opcional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </FormSection>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="brand" onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Guardando…" : "Agregar carga"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar carga?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará{" "}
              <span className="font-semibold text-foreground">{toDelete?.label}</span> de este viaje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={submitting}
            >
              {submitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
