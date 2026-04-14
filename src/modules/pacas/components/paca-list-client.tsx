"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Plus,
  Trash2,
  Shirt,
  CheckCircle2,
  Clock,
  ArrowDownCircle,
  Layers,
} from "lucide-react";
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
    } else toast.error(result.error);
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
    } else toast.error(result.error);
  };

  const totalAvailable = inventory.reduce((s, i) => s + i.available, 0);
  const totalReserved = inventory.reduce((s, i) => s + i.reserved, 0);
  const totalSold = inventory.reduce((s, i) => s + i.sold, 0);

  const summaryCards = [
    { label: "Disponibles", value: totalAvailable, icon: CheckCircle2, color: "text-[var(--success)]", bg: "from-[var(--success)]/20 to-[var(--success)]/5", ring: "ring-[var(--success)]/20" },
    { label: "Reservadas",  value: totalReserved,  icon: Clock,         color: "text-[var(--info)]",    bg: "from-[var(--info)]/20 to-[var(--info)]/5",       ring: "ring-[var(--info)]/20" },
    { label: "Vendidas",    value: totalSold,      icon: ArrowDownCircle, color: "text-muted-foreground",bg: "from-muted to-transparent",                       ring: "ring-border" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Shirt}
        title="Inventario de pacas"
        description="Stock por categoría con seguimiento de disponibles, reservadas y vendidas."
      >
        <Button variant="brand" onClick={() => setIsEntryOpen(true)}>
          <Plus className="h-4 w-4" />
          Registrar entrada
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map((s) => (
          <div
            key={s.label}
            className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-panel"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {s.label}
                </p>
                <p className="text-3xl font-bold font-headline tabular-nums text-foreground mt-1">
                  {s.value}
                </p>
              </div>
              <div className={`flex size-11 items-center justify-center rounded-lg bg-gradient-to-br ${s.bg} ring-1 ring-inset ${s.ring}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} strokeWidth={2.2} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Inventory table */}
      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-headline font-semibold text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-[var(--brand)]" />
            Inventario por categoría
          </h2>
          <Badge variant="brand">{inventory.length}</Badge>
        </div>

        {inventory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr className="text-left text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-5 py-2.5">Categoría</th>
                  <th className="px-3 py-2.5">Clasificación</th>
                  <th className="px-3 py-2.5 text-center">Disponible</th>
                  <th className="px-3 py-2.5 text-center">Reserv.</th>
                  <th className="px-3 py-2.5 text-center">Vendida</th>
                  <th className="px-3 py-2.5 text-right">Costo/U</th>
                  <th className="px-5 py-2.5 text-right">Valor stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {inventory.map((item) => {
                  const inStock = item.available + item.reserved;
                  const avgCost = inStock > 0 ? Number(item.totalCost) / inStock : 0;
                  const stockValue = Number(item.totalCost);
                  return (
                    <tr key={item.categoryId} className="transition-colors hover:bg-[var(--brand)]/[0.04]">
                      <td className="px-5 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Shirt className="h-4 w-4 text-muted-foreground" />
                          {item.category.name}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {item.category.classification ? (
                          <Badge variant="outline">{item.category.classification.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Badge variant={item.available > 0 ? "success" : "destructive"}>
                          {item.available}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {item.reserved > 0 ? (
                          <Badge variant="info">{item.reserved}</Badge>
                        ) : (
                          <span className="text-muted-foreground tabular-nums">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-muted-foreground tabular-nums">{item.sold}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {avgCost > 0 ? `$${avgCost.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums text-foreground">
                        {stockValue > 0 ? `$${stockValue.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8">
            <EmptyState title="Sin inventario" description="Registra la primera entrada de pacas para empezar." />
          </div>
        )}
      </div>

      {/* Recent entries */}
      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-headline font-semibold text-foreground flex items-center gap-2">
            <ArrowDownCircle className="h-4 w-4 text-[var(--brand)]" />
            Entradas recientes
          </h2>
          <Badge variant="outline">{entries.length}</Badge>
        </div>
        <div className="divide-y divide-border/60">
          {entries.length > 0 ? (
            entries.map((entry) => (
              <div
                key={entry.entryId}
                className="group flex items-center justify-between px-5 py-3 transition-colors hover:bg-[var(--brand)]/[0.04]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-foreground">{entry.category.name}</span>
                    <Badge variant="success">+{entry.quantity}</Badge>
                  </div>
                  <p className="text-[0.82rem] text-muted-foreground">
                    {[
                      entry.supplier && `Proveedor: ${entry.supplier}`,
                      entry.purchasePrice && `Precio: $${String(entry.purchasePrice)}`,
                      entry.arrivalDate && `Fecha: ${entry.arrivalDate}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || new Date(entry.createdAt).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-destructive opacity-60 group-hover:opacity-100"
                  onClick={() => setEntryToDelete(entry.entryId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          ) : (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">
              Sin entradas registradas.
            </div>
          )}
        </div>
      </div>

      <PacaEntryForm
        open={isEntryOpen}
        onOpenChange={setIsEntryOpen}
        onSubmit={handleCreateEntry}
        isLoading={isSubmitting}
        categories={categories}
      />

      <AlertDialog open={!!entryToDelete} onOpenChange={() => setEntryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar entrada?</AlertDialogTitle>
            <AlertDialogDescription>
              Se descontarán las pacas del inventario disponible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEntry}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
