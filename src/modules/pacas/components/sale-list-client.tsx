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
  pacaId: number;
  clientName: string;
  clientPhone: string | null;
  saleDate: string;
  salePrice: unknown;
  paymentMethod: string | null;
  notes: string | null;
  paca: { code: string; category: { name: string } };
}

interface PacaOption {
  pacaId: number;
  code: string;
  salePrice: unknown;
}

interface Props {
  sales: SaleItem[];
  availablePacas: PacaOption[];
  stats: { totalSales: number; totalRevenue: number };
}

export function SaleListClient({ sales, availablePacas, stats }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = sales.filter(
    (s) =>
      s.clientName.toLowerCase().includes(search.toLowerCase()) ||
      s.paca.code.toLowerCase().includes(search.toLowerCase())
  );

  const getPaymentLabel = (method: string | null) =>
    PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method ?? "N/A";

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const result = await createSale({
      pacaId: Number(fd.get("pacaId")),
      clientName: fd.get("clientName") as string,
      clientPhone: (fd.get("clientPhone") as string) || undefined,
      saleDate: fd.get("saleDate") as string,
      salePrice: Number(fd.get("salePrice")),
      paymentMethod: (fd.get("paymentMethod") as string) || undefined,
      notes: (fd.get("notes") as string) || undefined,
    });
    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      toast.success("Venta registrada");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsSubmitting(true);
    const result = await deleteSale(toDelete);
    setIsSubmitting(false);
    if (result.success) {
      setToDelete(null);
      toast.success("Venta eliminada");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.totalSales}</p>
            <p className="text-sm text-muted-foreground">Ventas totales</p>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Ingresos totales</p>
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-6 py-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium">Ventas</h2>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Registrar Venta
            </Button>
          </div>
          <div className="mt-4">
            <InputGroup>
              <InputGroupInput placeholder="Buscar por cliente o codigo..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupAddon align="inline-end"><Badge>{filtered.length}</Badge></InputGroupAddon>
            </InputGroup>
          </div>
        </div>
        <div className="grid gap-4 p-6">
          {filtered.length > 0 ? filtered.map((s) => (
            <div key={s.saleId} className="bg-card border rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{s.clientName}</span>
                  <Badge variant="outline">${String(s.salePrice)}</Badge>
                  <Badge variant="secondary">{getPaymentLabel(s.paymentMethod)}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Paca: <span className="font-medium text-foreground">{s.paca.code}</span> ({s.paca.category.name})</p>
                  <p>Fecha: {s.saleDate} {s.clientPhone ? `| Tel: ${s.clientPhone}` : ""}</p>
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

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Registrar Venta</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Paca *</Label>
              <Select name="pacaId">
                <SelectTrigger><SelectValue placeholder="Seleccionar paca..." /></SelectTrigger>
                <SelectContent>
                  {availablePacas.map((p) => (
                    <SelectItem key={p.pacaId} value={String(p.pacaId)}>
                      {p.code} {p.salePrice ? `- $${String(p.salePrice)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre del cliente *</Label>
              <Input name="clientName" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefono</Label>
                <Input name="clientPhone" />
              </div>
              <div className="space-y-2">
                <Label>Fecha de venta *</Label>
                <Input name="saleDate" type="date" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio de venta *</Label>
                <Input name="salePrice" type="number" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label>Metodo de pago</Label>
                <Select name="paymentMethod">
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea name="notes" />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Registrando..." : "Registrar Venta"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Eliminar venta?</AlertDialogTitle>
            <AlertDialogDescription>La paca volvera a estar disponible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isSubmitting}>
              {isSubmitting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
