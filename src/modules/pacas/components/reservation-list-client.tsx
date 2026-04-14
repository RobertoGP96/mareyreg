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
import { FormSection } from "@/components/ui/form-section";
import {
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Pen,
  Trash2,
  MoreHorizontal,
  BookmarkCheck,
  User,
  Phone,
  Mail,
  Calendar,
  Layers,
  Hash,
  DollarSign,
  CreditCard,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  createReservation,
  updateReservation,
  deleteReservation,
  cancelReservation,
  completeReservation,
} from "../actions/paca-reservation-actions";
import { RESERVATION_STATUSES, PAYMENT_METHODS } from "@/lib/constants";

interface ReservationItem {
  reservationId: number;
  categoryId: number;
  quantity: number;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  reservationDate: string;
  expirationDate: string | null;
  notes: string | null;
  status: string;
  category: { name: string; classification: { name: string } | null };
}

interface CategoryOption {
  categoryId: number;
  name: string;
  available: number;
}

const STATUS_BADGE: Record<string, "success" | "info" | "destructive" | "warning"> = {
  active: "success",
  completed: "info",
  cancelled: "destructive",
};

export function ReservationListClient({
  reservations,
  availableCategories,
}: {
  reservations: ReservationItem[];
  availableCategories: CategoryOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<ReservationItem | null>(null);
  const [toCancel, setToCancel] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [toComplete, setToComplete] = useState<ReservationItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = reservations.filter(
    (r) =>
      r.clientName.toLowerCase().includes(search.toLowerCase()) ||
      r.category.name.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusLabel = (status: string) =>
    RESERVATION_STATUSES.find((s) => s.value === status)?.label ?? status;

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const result = await createReservation({
      categoryId: Number(fd.get("categoryId")),
      quantity: Number(fd.get("quantity")),
      clientName: fd.get("clientName") as string,
      clientPhone: (fd.get("clientPhone") as string) || undefined,
      clientEmail: (fd.get("clientEmail") as string) || undefined,
      reservationDate: fd.get("reservationDate") as string,
      expirationDate: (fd.get("expirationDate") as string) || undefined,
      notes: (fd.get("notes") as string) || undefined,
    });
    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      toast.success("Reservación creada");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!toEdit) return;
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const result = await updateReservation(toEdit.reservationId, {
      clientName: fd.get("clientName") as string,
      clientPhone: (fd.get("clientPhone") as string) || undefined,
      clientEmail: (fd.get("clientEmail") as string) || undefined,
      reservationDate: fd.get("reservationDate") as string,
      expirationDate: (fd.get("expirationDate") as string) || undefined,
      notes: (fd.get("notes") as string) || undefined,
      quantity: Number(fd.get("quantity")),
    });
    setIsSubmitting(false);
    if (result.success) {
      setToEdit(null);
      toast.success("Reservación actualizada");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleComplete = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!toComplete) return;
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const result = await completeReservation(toComplete.reservationId, {
      salePrice: Number(fd.get("salePrice")),
      paymentMethod: (fd.get("paymentMethod") as string) || undefined,
      saleDate: fd.get("saleDate") as string,
      notes: (fd.get("notes") as string) || undefined,
    });
    setIsSubmitting(false);
    if (result.success) {
      setToComplete(null);
      toast.success("Reservación completada y venta registrada");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleCancel = async () => {
    if (!toCancel) return;
    setIsSubmitting(true);
    const result = await cancelReservation(toCancel);
    setIsSubmitting(false);
    if (result.success) {
      setToCancel(null);
      toast.success("Reservación cancelada");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsSubmitting(true);
    const result = await deleteReservation(toDelete);
    setIsSubmitting(false);
    if (result.success) {
      setToDelete(null);
      toast.success("Reservación eliminada");
      router.refresh();
    } else toast.error(result.error);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={BookmarkCheck}
        title="Reservaciones"
        description="Gestiona reservaciones de pacas por cliente y completa ventas cuando se cierran."
        badge={`${reservations.length} reservaciones`}
      >
        <Button variant="brand" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva reservación
        </Button>
      </PageHeader>

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
            filtered.map((r) => (
              <div
                key={r.reservationId}
                className="group px-5 py-4 transition-colors hover:bg-[var(--brand)]/[0.04]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-semibold text-foreground">{r.clientName}</span>
                      <Badge variant={STATUS_BADGE[r.status] || "outline"}>
                        {getStatusLabel(r.status)}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Hash className="h-3 w-3" />
                        {r.quantity} pacas
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground">{r.category.name}</span>
                        {r.category.classification && (
                          <span className="opacity-70">· {r.category.classification.name}</span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {r.reservationDate}
                        {r.expirationDate && ` → ${r.expirationDate}`}
                      </span>
                      {r.clientPhone && (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {r.clientPhone}
                        </span>
                      )}
                    </div>
                    {r.notes && (
                      <p className="mt-1.5 text-[0.82rem] text-muted-foreground italic line-clamp-2">
                        “{r.notes}”
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {r.status === "active" && (
                      <Button size="sm" variant="brand" onClick={() => setToComplete(r)}>
                        <CheckCircle className="h-4 w-4" />
                        Completar
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 opacity-60 group-hover:opacity-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {r.status === "active" && (
                          <>
                            <DropdownMenuItem onClick={() => setToEdit(r)}>
                              <Pen className="h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setToCancel(r.reservationId)}
                              className="text-[var(--warning)] focus:text-[var(--warning)]"
                            >
                              <XCircle className="h-4 w-4" /> Cancelar
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => setToDelete(r.reservationId)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8">
              <EmptyState
                title="No hay reservaciones"
                description={
                  search
                    ? `No se encontraron resultados para "${search}".`
                    : "Crea la primera reservación para empezar."
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Crear */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle asChild>
              <FormDialogHeader
                icon={BookmarkCheck}
                title="Nueva reservación"
                description="Reserva pacas para un cliente indicando cantidad y fecha."
              />
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Categoría" icon={Layers} required>
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
            <Field label="Cliente" icon={User} required>
              <Input name="clientName" required placeholder="Nombre del cliente" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Teléfono" icon={Phone}>
                <Input name="clientPhone" />
              </Field>
              <Field label="Email" icon={Mail}>
                <Input name="clientEmail" type="email" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Fecha reservación" icon={Calendar} required>
                <Input name="reservationDate" type="date" required />
              </Field>
              <Field label="Fecha expiración" icon={Calendar}>
                <Input name="expirationDate" type="date" />
              </Field>
            </div>
            <Field label="Notas">
              <Textarea name="notes" />
            </Field>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Creando…" : "Crear reservación"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Editar */}
      <Dialog open={!!toEdit} onOpenChange={(o) => !o && setToEdit(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle asChild>
              <FormDialogHeader
                icon={Pen}
                title="Editar reservación"
                description={toEdit?.clientName}
              />
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-5">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Categoría:</span> {toEdit?.category.name}
            </div>
            <Field label="Cantidad" icon={Hash} required>
              <Input name="quantity" type="number" min="1" defaultValue={toEdit?.quantity} required />
            </Field>
            <Field label="Cliente" icon={User} required>
              <Input name="clientName" defaultValue={toEdit?.clientName} required />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Teléfono" icon={Phone}>
                <Input name="clientPhone" defaultValue={toEdit?.clientPhone ?? ""} />
              </Field>
              <Field label="Email" icon={Mail}>
                <Input name="clientEmail" type="email" defaultValue={toEdit?.clientEmail ?? ""} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Fecha reservación" icon={Calendar} required>
                <Input name="reservationDate" type="date" defaultValue={toEdit?.reservationDate} required />
              </Field>
              <Field label="Fecha expiración" icon={Calendar}>
                <Input name="expirationDate" type="date" defaultValue={toEdit?.expirationDate ?? ""} />
              </Field>
            </div>
            <Field label="Notas">
              <Textarea name="notes" defaultValue={toEdit?.notes ?? ""} />
            </Field>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setToEdit(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Actualizando…" : "Actualizar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Completar */}
      <Dialog open={!!toComplete} onOpenChange={(o) => !o && setToComplete(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle asChild>
              <FormDialogHeader
                icon={CheckCircle}
                title="Completar reservación"
                description="Registra la venta con precio y método de pago."
              />
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm space-y-1.5 mb-2">
            <p className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Cliente:</span> {toComplete?.clientName}
            </p>
            <p className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Categoría:</span> {toComplete?.category.name}
            </p>
            <p className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Cantidad:</span> {toComplete?.quantity} pacas
            </p>
          </div>
          <form onSubmit={handleComplete} className="space-y-5">
            <FormSection icon={DollarSign} title="Datos de venta" description="Precio por unidad y fecha.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Precio por unidad" icon={DollarSign} required>
                  <Input name="salePrice" type="number" step="0.01" required placeholder="Ej. 35.00" />
                </Field>
                <Field label="Fecha de venta" icon={Calendar} required>
                  <Input name="saleDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
                </Field>
              </div>
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
              <Field label="Notas">
                <Textarea name="notes" placeholder="Observaciones de la venta…" />
              </Field>
            </FormSection>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setToComplete(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Completando…" : "Registrar venta"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancelar */}
      <AlertDialog open={!!toCancel} onOpenChange={() => setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar reservación?</AlertDialogTitle>
            <AlertDialogDescription>
              Las pacas volverán a estar disponibles. La reservación quedará marcada como cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-[var(--warning)] text-white hover:opacity-90"
              disabled={isSubmitting}
            >
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Eliminar */}
      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar reservación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente este registro. Si estaba activa, las pacas volverán a estar disponibles.
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
