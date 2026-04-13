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
import { Plus, Search, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { createReservation, cancelReservation, completeReservation } from "../actions/paca-reservation-actions";
import { RESERVATION_STATUSES } from "@/lib/constants";

interface ReservationItem {
  reservationId: number;
  pacaId: number;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  reservationDate: string;
  expirationDate: string | null;
  notes: string | null;
  status: string;
  paca: { code: string; category: { name: string } };
}

interface PacaOption {
  pacaId: number;
  code: string;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
  expired: "bg-yellow-100 text-yellow-800",
};

export function ReservationListClient({
  reservations,
  availablePacas,
}: {
  reservations: ReservationItem[];
  availablePacas: PacaOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toCancel, setToCancel] = useState<number | null>(null);
  const [toComplete, setToComplete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = reservations.filter(
    (r) =>
      r.clientName.toLowerCase().includes(search.toLowerCase()) ||
      r.paca.code.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusLabel = (status: string) =>
    RESERVATION_STATUSES.find((s) => s.value === status)?.label ?? status;

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const result = await createReservation({
      pacaId: Number(fd.get("pacaId")),
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
      toast.success("Reservacion creada");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleCancel = async () => {
    if (!toCancel) return;
    setIsSubmitting(true);
    const result = await cancelReservation(toCancel);
    setIsSubmitting(false);
    if (result.success) {
      setToCancel(null);
      toast.success("Reservacion cancelada");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleComplete = async () => {
    if (!toComplete) return;
    setIsSubmitting(true);
    const result = await completeReservation(toComplete);
    setIsSubmitting(false);
    if (result.success) {
      setToComplete(null);
      toast.success("Reservacion completada - paca marcada como vendida");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-6 py-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium">Reservaciones</h2>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Agregar
            </Button>
          </div>
          <div className="mt-4">
            <InputGroup>
              <InputGroupInput placeholder="Buscar por cliente o codigo de paca..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupAddon align="inline-end"><Badge>{filtered.length}</Badge></InputGroupAddon>
            </InputGroup>
          </div>
        </div>
        <div className="grid gap-4 p-6">
          {filtered.length > 0 ? filtered.map((r) => (
            <div key={r.reservationId} className="bg-card border rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{r.clientName}</span>
                    <Badge className={STATUS_COLORS[r.status]}>{getStatusLabel(r.status)}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    <p>Paca: <span className="font-medium text-foreground">{r.paca.code}</span> ({r.paca.category.name})</p>
                    <p>Fecha: {r.reservationDate} {r.expirationDate ? `| Expira: ${r.expirationDate}` : ""}</p>
                    {r.clientPhone && <p>Tel: {r.clientPhone}</p>}
                    {r.notes && <p>Notas: {r.notes}</p>}
                  </div>
                </div>
                {r.status === "active" && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setToComplete(r.reservationId)}>
                      <CheckCircle className="h-4 w-4 mr-1" />Completar
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setToCancel(r.reservationId)}>
                      <XCircle className="h-4 w-4 mr-1" />Cancelar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )) : <EmptyState title="No hay reservaciones" description="No se encontraron reservaciones." />}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nueva Reservacion</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Paca *</Label>
              <Select name="pacaId">
                <SelectTrigger><SelectValue placeholder="Seleccionar paca disponible..." /></SelectTrigger>
                <SelectContent>
                  {availablePacas.map((p) => (
                    <SelectItem key={p.pacaId} value={String(p.pacaId)}>{p.code}</SelectItem>
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
                <Label>Email</Label>
                <Input name="clientEmail" type="email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de reservacion *</Label>
                <Input name="reservationDate" type="date" required />
              </div>
              <div className="space-y-2">
                <Label>Fecha de expiracion</Label>
                <Input name="expirationDate" type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea name="notes" />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear Reservacion"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirm */}
      <AlertDialog open={!!toCancel} onOpenChange={() => setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cancelar reservacion?</AlertDialogTitle>
            <AlertDialogDescription>La paca volvera a estar disponible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isSubmitting}>
              {isSubmitting ? "Cancelando..." : "Si, Cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Confirm */}
      <AlertDialog open={!!toComplete} onOpenChange={() => setToComplete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Completar reservacion?</AlertDialogTitle>
            <AlertDialogDescription>La paca sera marcada como vendida.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete} disabled={isSubmitting}>
              {isSubmitting ? "Completando..." : "Si, Completar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
