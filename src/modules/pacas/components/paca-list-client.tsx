"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Trash2, Package } from "lucide-react";
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
import { toast } from "sonner";
import { createPacaEntry, deletePacaEntry } from "../actions/paca-actions";
import { PacaEntryForm } from "./paca-form";

interface InventoryItem {
  categoryId: number;
  available: number;
  reserved: number;
  sold: number;
  totalCost: unknown;
  category: {
    name: string;
    classification: { name: string } | null;
  };
}

interface EntryItem {
  entryId: number;
  quantity: number;
  purchasePrice: unknown;
  supplier: string | null;
  origin: string | null;
  arrivalDate: string | null;
  createdAt: Date;
  category: { name: string };
}

interface CategoryItem {
  categoryId: number;
  name: string;
}

interface Props {
  inventory: InventoryItem[];
  entries: EntryItem[];
  categories: CategoryItem[];
}

export function PacaListClient({ inventory, entries, categories }: Props) {
  const router = useRouter();
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateEntry = async (data: Parameters<typeof createPacaEntry>[0]) => {
    setIsSubmitting(true);
    const result = await createPacaEntry(data);
    setIsSubmitting(false);
    if (result.success) {
      setIsEntryOpen(false);
      toast.success("Entrada registrada exitosamente");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;
    setIsSubmitting(true);
    const result = await deletePacaEntry(entryToDelete);
    setIsSubmitting(false);
    if (result.success) {
      setEntryToDelete(null);
      toast.success("Entrada eliminada");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const totalAvailable = inventory.reduce((s, i) => s + i.available, 0);
  const totalReserved = inventory.reduce((s, i) => s + i.reserved, 0);
  const totalSold = inventory.reduce((s, i) => s + i.sold, 0);

  return (
    <>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-xl font-bold text-green-600">{totalAvailable}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Disponibles</p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-xl font-bold text-blue-600">{totalReserved}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Reservadas</p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-xl font-bold text-muted-foreground">{totalSold}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Vendidas</p>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-4 py-3 border-b flex justify-between items-center">
          <h2 className="text-base font-medium">Inventario por Categoria</h2>
          <Button onClick={() => setIsEntryOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Registrar Entrada
          </Button>
        </div>

        {inventory.length > 0 ? (
          <div className="divide-y">
            <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50">
              <div className="col-span-3">Categoria</div>
              <div className="col-span-2">Clasificacion</div>
              <div className="col-span-2 text-center">Disponible</div>
              <div className="col-span-1 text-center">Reserv.</div>
              <div className="col-span-1 text-center">Vendida</div>
              <div className="col-span-1 text-center">Costo/U</div>
              <div className="col-span-2 text-right">Valor Stock</div>
            </div>
            {inventory.map((item) => {
              const inStock = item.available + item.reserved;
              const avgCost = inStock > 0 ? Number(item.totalCost) / inStock : 0;
              const stockValue = Number(item.totalCost);
              return (
                <div key={item.categoryId} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-muted/30 transition-colors">
                  <div className="col-span-3 font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    {item.category.name}
                  </div>
                  <div className="col-span-2">
                    {item.category.classification ? (
                      <Badge variant="outline" className="text-xs">{item.category.classification.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </div>
                  <div className="col-span-2 text-center">
                    <Badge className={item.available > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {item.available}
                    </Badge>
                  </div>
                  <div className="col-span-1 text-center">
                    {item.reserved > 0 ? (
                      <Badge className="bg-blue-100 text-blue-800">{item.reserved}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </div>
                  <div className="col-span-1 text-center text-muted-foreground">{item.sold}</div>
                  <div className="col-span-1 text-center text-sm">
                    {avgCost > 0 ? `$${avgCost.toFixed(2)}` : "—"}
                  </div>
                  <div className="col-span-2 text-right font-medium text-sm">
                    {stockValue > 0 ? `$${stockValue.toFixed(2)}` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState title="Sin inventario" description="Registra la primera entrada de pacas." />
          </div>
        )}
      </div>

      {/* Recent Entries */}
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h2 className="text-base font-medium">Entradas Recientes</h2>
        </div>
        <div className="divide-y">
          {entries.length > 0 ? entries.map((entry) => (
            <div key={entry.entryId} className="px-4 py-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{entry.category.name}</span>
                  <Badge variant="secondary">+{entry.quantity}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {[
                    entry.supplier && `Proveedor: ${entry.supplier}`,
                    entry.purchasePrice && `Precio: $${String(entry.purchasePrice)}`,
                    entry.arrivalDate && `Fecha: ${entry.arrivalDate}`,
                  ].filter(Boolean).join(" | ") || new Date(entry.createdAt).toLocaleDateString("es-ES")}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setEntryToDelete(entry.entryId)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )) : (
            <div className="px-4 py-4 text-center text-muted-foreground">Sin entradas registradas</div>
          )}
        </div>
      </div>

      {/* Entry Form */}
      <PacaEntryForm
        open={isEntryOpen}
        onOpenChange={setIsEntryOpen}
        onSubmit={handleCreateEntry}
        isLoading={isSubmitting}
        categories={categories}
      />

      {/* Delete Entry Confirm */}
      <AlertDialog open={!!entryToDelete} onOpenChange={() => setEntryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar entrada?</AlertDialogTitle>
            <AlertDialogDescription>Se descontaran las pacas del inventario disponible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isSubmitting}>
              {isSubmitting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
