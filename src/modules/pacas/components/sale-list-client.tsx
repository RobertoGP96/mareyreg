"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Trash2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { createSale, deleteSale } from "../actions/paca-sale-actions";
import { PAYMENT_METHODS } from "@/lib/constants";

interface SaleItem {
  saleId: number;
  categoryId: number;
  quantity: number;
  salePrice: unknown;
  clientName: string;
  clientPhone: string | null;
  paymentMethod: string | null;
  saleDate: string;
  notes: string | null;
  category: { name: string; classification: { name: string } | null };
}

interface CategoryOption {
  categoryId: number;
  name: string;
  available: number;
}

interface Props {
  sales: SaleItem[];
  availableCategories: CategoryOption[];
  stats: { totalSales: number; totalRevenue: number };
}

export function SaleListClient({ sales, availableCategories, stats }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = sales.filter(
    (s) =>
      s.clientName.toLowerCase().includes(search.toLowerCase()) ||
      s.category.name.toLowerCase().includes(search.toLowerCase())
  );

  const getPaymentLabel = (method: string | null) =>
    PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method ?? "N/A";

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const result = await createSale({
      categoryId: Number(fd.get("categoryId")),
      quantity: Number(fd.get("quantity")),
      salePrice: Number(fd.get("salePrice")),
      clientName: fd.get("clientName") as string,
      clientPhone: (fd.get("clientPhone") as string) || undefined,
      paymentMethod: (fd.get("paymentMethod") as string) || undefined,
      saleDate: fd.get("saleDate") as string,
      notes: (fd.get("notes") as string) || undefined,
    });
    setIsSubmitting(false);
    if (result.success) { setIsCreateOpen(false); toast.success("Venta registrada"); router.refresh(); }
    else { toast.error(result.error); }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsSubmitting(true);
    const result = await deleteSale(toDelete);
    setIsSubmitting(false);
    if (result.success) { setToDelete(null); toast.success("Venta eliminada"); router.refresh(); }
    else { toast.error(result.error); }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted"><DollarSign className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <p className="text-xl font-semibold">{stats.totalSales}</p>
            <p className="text-sm text-muted-foreground">Pacas vendidas</p>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted"><DollarSign className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <p className="text-xl font-semibold">${stats.totalRevenue.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Ingresos totales</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-medium">Ventas</h2>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Registrar Venta
            </Button>
          </div>
          <div className="mt-4">
            <InputGroup>
              <InputGroupInput placeholder="Buscar por cliente o categoria..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupAddon align="inline-end"><Badge>{filtered.length}</Badge></InputGroupAddon>
            </InputGroup>
          </div>
        </div>
        <div className="grid gap-4 p-4">
          {filtered.length > 0 ? filtered.map((s) => (
            <div key={s.saleId} className="bg-card border rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{s.clientName}</span>
                  <Badge variant="outline">{s.quantity} pacas</Badge>
                  <Badge variant="secondary">${String(s.salePrice)}/u</Badge>
                  <Badge variant="secondary">{getPaymentLabel(s.paymentMethod)}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Categoria: <span className="font-medium text-foreground">{s.category.name}</span></p>
                  <p>Fecha: {s.saleDate} | Total: ${(s.quantity * Number(s.salePrice)).toFixed(2)} {s.clientPhone ? `| Tel: ${s.clientPhone}` : ""}</p>
                  {s.notes && <p>Notas: {s.notes}</p>}
                </div>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToDelete(s.saleId)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )) : <EmptyState title="No hay ventas" description="No se han registrado ventas." />}
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Registrar Venta</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select name="categoryId">
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((c) => (
                      <SelectItem key={c.categoryId} value={String(c.categoryId)}>
                        {c.name} ({c.available} disp.)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cantidad *</Label>
                <Input name="quantity" type="number" min="1" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Input name="clientName" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Telefono</Label><Input name="clientPhone" /></div>
              <div className="space-y-2"><Label>Fecha *</Label><Input name="saleDate" type="date" required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Precio por unidad *</Label><Input name="salePrice" type="number" step="0.01" required /></div>
              <div className="space-y-2">
                <Label>Metodo de pago</Label>
                <Select name="paymentMethod">
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Notas</Label><Textarea name="notes" /></div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Registrando..." : "Registrar Venta"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Eliminar venta?</AlertDialogTitle>
            <AlertDialogDescription>Las pacas volveran a estar disponibles.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isSubmitting}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
