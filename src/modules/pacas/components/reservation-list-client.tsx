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
import { Plus, Search, CheckCircle, XCircle, Pen, Trash2, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { createReservation, updateReservation, deleteReservation, cancelReservation, completeReservation } from "../actions/paca-reservation-actions";
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

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
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
    if (result.success) { setIsCreateOpen(false); toast.success("Reservacion creada"); router.refresh(); }
    else { toast.error(result.error); }
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
    if (result.success) { setToEdit(null); toast.success("Reservacion actualizada"); router.refresh(); }
    else { toast.error(result.error); }
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
    if (result.success) { setToComplete(null); toast.success("Reservacion completada y venta registrada"); router.refresh(); }
    else { toast.error(result.error); }
  };

  const handleCancel = async () => {
    if (!toCancel) return;
    setIsSubmitting(true);
    const result = await cancelReservation(toCancel);
    setIsSubmitting(false);
    if (result.success) { setToCancel(null); toast.success("Reservacion cancelada"); router.refresh(); }
    else { toast.error(result.error); }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsSubmitting(true);
    const result = await deleteReservation(toDelete);
    setIsSubmitting(false);
    if (result.success) { setToDelete(null); toast.success("Reservacion eliminada"); router.refresh(); }
    else { toast.error(result.error); }
  };

  return (
    <>
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-4 py-3 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-medium">Reservaciones</h2>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Agregar
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
          {filtered.length > 0 ? filtered.map((r) => (
            <div key={r.reservationId} className="bg-card border rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{r.clientName}</span>
                    <Badge className={STATUS_COLORS[r.status]}>{getStatusLabel(r.status)}</Badge>
                    <Badge variant="outline">{r.quantity} pacas</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    <p>Categoria: <span className="font-medium text-foreground">{r.category.name}</span>
                      {r.category.classification && <span className="text-xs ml-1">({r.category.classification.name})</span>}
                    </p>
                    <p>Fecha: {r.reservationDate} {r.expirationDate ? `| Expira: ${r.expirationDate}` : ""}</p>
                    {r.clientPhone && <p>Tel: {r.clientPhone}</p>}
                    {r.notes && <p>Notas: {r.notes}</p>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {r.status === "active" && (
                    <Button size="sm" onClick={() => setToComplete(r)}>
                      <CheckCircle className="h-4 w-4 mr-1" />Completar
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {r.status === "active" && (
                        <>
                          <DropdownMenuItem onClick={() => setToEdit(r)}>
                            <Pen className="h-4 w-4 mr-2" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setToCancel(r.reservationId)} className="text-orange-600">
                            <XCircle className="h-4 w-4 mr-2" />Cancelar
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem onClick={() => setToDelete(r.reservationId)} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          )) : <EmptyState title="No hay reservaciones" description="No se encontraron reservaciones." />}
        </div>
      </div>

      {/* Crear Reservacion */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nueva Reservacion</DialogTitle></DialogHeader>
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
            <div className="space-y-2"><Label>Cliente *</Label><Input name="clientName" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Telefono</Label><Input name="clientPhone" /></div>
              <div className="space-y-2"><Label>Email</Label><Input name="clientEmail" type="email" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Fecha reservacion *</Label><Input name="reservationDate" type="date" required /></div>
              <div className="space-y-2"><Label>Fecha expiracion</Label><Input name="expirationDate" type="date" /></div>
            </div>
            <div className="space-y-2"><Label>Notas</Label><Textarea name="notes" /></div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear Reservacion"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Editar Reservacion */}
      <Dialog open={!!toEdit} onOpenChange={(o) => !o && setToEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Reservacion</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="p-3 bg-muted rounded-md text-sm">
              <span className="font-medium">Categoria:</span> {toEdit?.category.name}
            </div>
            <div className="space-y-2">
              <Label>Cantidad *</Label>
              <Input name="quantity" type="number" min="1" defaultValue={toEdit?.quantity} required />
            </div>
            <div className="space-y-2"><Label>Cliente *</Label><Input name="clientName" defaultValue={toEdit?.clientName} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Telefono</Label><Input name="clientPhone" defaultValue={toEdit?.clientPhone ?? ""} /></div>
              <div className="space-y-2"><Label>Email</Label><Input name="clientEmail" type="email" defaultValue={toEdit?.clientEmail ?? ""} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Fecha reservacion *</Label><Input name="reservationDate" type="date" defaultValue={toEdit?.reservationDate} required /></div>
              <div className="space-y-2"><Label>Fecha expiracion</Label><Input name="expirationDate" type="date" defaultValue={toEdit?.expirationDate ?? ""} /></div>
            </div>
            <div className="space-y-2"><Label>Notas</Label><Textarea name="notes" defaultValue={toEdit?.notes ?? ""} /></div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Actualizando..." : "Actualizar Reservacion"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Completar Reservacion — Formulario de datos de venta */}
      <Dialog open={!!toComplete} onOpenChange={(o) => !o && setToComplete(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Completar Reservacion — Datos de Venta</DialogTitle></DialogHeader>
          <div className="p-3 bg-muted rounded-md text-sm space-y-1">
            <p><span className="font-medium">Cliente:</span> {toComplete?.clientName}</p>
            <p><span className="font-medium">Categoria:</span> {toComplete?.category.name}</p>
            <p><span className="font-medium">Cantidad:</span> {toComplete?.quantity} pacas</p>
          </div>
          <form onSubmit={handleComplete} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio de venta por unidad *</Label>
                <Input name="salePrice" type="number" step="0.01" required placeholder="Ej: 35.00" />
              </div>
              <div className="space-y-2">
                <Label>Fecha de venta *</Label>
                <Input name="saleDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
              </div>
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
            <div className="space-y-2"><Label>Notas</Label><Textarea name="notes" placeholder="Observaciones de la venta..." /></div>
            {toComplete && (
              <p className="text-sm text-muted-foreground">
                Total estimado: <span className="font-bold text-foreground">{toComplete.quantity} pacas</span> — Completa el precio para registrar la venta
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Completando..." : "Completar y Registrar Venta"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancelar */}
      <AlertDialog open={!!toCancel} onOpenChange={() => setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cancelar reservacion?</AlertDialogTitle>
            <AlertDialogDescription>Las pacas volveran a estar disponibles. La reservacion quedara como cancelada.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-orange-600 hover:bg-orange-700" disabled={isSubmitting}>Si, Cancelar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Eliminar */}
      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Eliminar reservacion?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminara permanentemente este registro. Si estaba activa, las pacas volveran a estar disponibles.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isSubmitting}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
