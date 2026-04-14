"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialogHeader } from "@/components/ui/field";
import {
  Plus,
  Search,
  Trash2,
  CircleDollarSign,
  ShoppingBag,
  UserRound,
  PhoneCall,
  CalendarDays,
  FolderTree,
  Hash,
  CreditCard,
  TrendingUp,
  Wallet,
  Loader2,
} from "lucide-react";
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
    if (result.success) {
      setIsCreateOpen(false);
      toast.success("Venta registrada");
      router.refresh();
    } else toast.error(result.error);
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
    } else toast.error(result.error);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ShoppingBag}
        title="Ventas de pacas"
        description="Historial de ventas con cliente, categoría y método de pago."
      >
        <Button variant="brand" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Registrar venta
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Pacas vendidas
              </p>
              <p className="text-3xl font-bold font-headline tabular-nums text-foreground mt-1">
                {stats.totalSales}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--info)]/20 to-[var(--info)]/5 ring-1 ring-inset ring-[var(--info)]/20">
              <ShoppingBag className="h-5 w-5 text-[var(--info)]" strokeWidth={2.2} />
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Ingresos totales
              </p>
              <p className="text-3xl font-bold font-headline tabular-nums text-[var(--success)] mt-1">
                ${stats.totalRevenue.toFixed(2)}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--success)]/20 to-[var(--success)]/5 ring-1 ring-inset ring-[var(--success)]/20">
              <TrendingUp className="h-5 w-5 text-[var(--success)]" strokeWidth={2.2} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <InputGroup className="flex-1 min-w-[240px]">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar por cliente o categoría…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <Badge variant="brand">{filtered.length}</Badge>
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="divide-y divide-border/60">
          {filtered.length > 0 ? (
            filtered.map((s) => {
              const total = s.quantity * Number(s.salePrice);
              return (
                <div
                  key={s.saleId}
                  className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--brand)]/[0.04]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-semibold text-foreground">{s.clientName}</span>
                      <Badge variant="outline" className="gap-1">
                        <Hash className="h-3 w-3" />
                        {s.quantity} pacas
                      </Badge>
                      <Badge variant="info">${String(s.salePrice)}/u</Badge>
                      <Badge variant="secondary">{getPaymentLabel(s.paymentMethod)}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <FolderTree className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground">{s.category.name}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {s.saleDate}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[var(--success)] font-semibold">
                        <CircleDollarSign className="h-3.5 w-3.5" />
                        Total: ${total.toFixed(2)}
                      </span>
                      {s.clientPhone && (
                        <span className="inline-flex items-center gap-1.5">
                          <PhoneCall className="h-3.5 w-3.5" />
                          {s.clientPhone}
                        </span>
                      )}
                    </div>
                    {s.notes && (
                      <p className="mt-1.5 text-[0.82rem] text-muted-foreground italic line-clamp-2">
                        “{s.notes}”
                      </p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive opacity-60 group-hover:opacity-100"
                    onClick={() => setToDelete(s.saleId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })
          ) : (
            <div className="p-8">
              <EmptyState
                title="No hay ventas"
                description={
                  search
                    ? `No se encontraron resultados para "${search}".`
                    : "Registra la primera venta para empezar."
                }
              />
            </div>
          )}
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <FormDialogHeader
                icon={ShoppingBag}
                title="Registrar venta"
                description="Crea una venta directa de pacas."
              />
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Categoría" icon={FolderTree} required>
                <Select name="categoryId">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((c) => (
                      <SelectItem key={c.categoryId} value={String(c.categoryId)}>
                        {c.name} ({c.available} disp.)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cantidad" icon={Hash} required>
                <Input name="quantity" type="number" min="1" required />
              </Field>
            </div>
            <Field label="Cliente" icon={UserRound} required>
              <Input name="clientName" required placeholder="Nombre del cliente" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Teléfono" icon={PhoneCall}>
                <Input name="clientPhone" />
              </Field>
              <Field label="Fecha de venta" icon={CalendarDays} required>
                <Input name="saleDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Precio por unidad" icon={CircleDollarSign} required>
                <Input name="salePrice" type="number" step="0.01" required placeholder="0.00" />
              </Field>
              <Field label="Método de pago" icon={CreditCard}>
                <Select name="paymentMethod">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Notas">
              <Textarea name="notes" placeholder="Observaciones de la venta…" />
            </Field>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Registrando…" : "Registrar venta"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Las pacas volverán a estar disponibles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
