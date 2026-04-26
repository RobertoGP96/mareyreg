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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { StatusPill } from "@/components/ui/status-pill";
import {
  CircleDollarSign,
  Plus,
  Trash2,
  Loader2,
  CalendarDays,
  CreditCard,
  FileText,
  MoreHorizontal,
  CircleCheck,
  CircleX,
  CircleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { PaymentStatus } from "@/generated/prisma";
import {
  createPayment,
  deletePayment,
  updatePaymentStatus,
} from "../actions/payment-actions";

export interface PaymentRow {
  paymentId: number;
  amount: number;
  paymentDate: string | null;
  paymentMethod: string | null;
  status: PaymentStatus;
  notes: string | null;
}

interface Props {
  tripId: number;
  payments: PaymentRow[];
}

const STATUS_PILL_MAP: Record<PaymentStatus, "paid" | "pending" | "cancelled"> = {
  paid: "paid",
  pending: "pending",
  cancelled: "cancelled",
};

export function PaymentPanel({ tripId, payments }: Props) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [notes, setNotes] = useState("");

  const totalPaid = payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const totalPending = payments.filter((p) => p.status === "pending").reduce((a, p) => a + p.amount, 0);

  const resetForm = () => {
    setAmount("");
    setPaymentDate("");
    setMethod("");
    setStatus("pending");
    setNotes("");
  };

  const handleCreate = async () => {
    const num = Number(amount);
    if (!num || num <= 0) {
      toast.error("Monto inválido");
      return;
    }
    setSubmitting(true);
    const r = await createPayment({
      trip_id: tripId,
      amount: num,
      payment_date: paymentDate || null,
      payment_method: method || null,
      status,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Pago registrado");
      setIsFormOpen(false);
      resetForm();
      router.refresh();
    } else toast.error(r.error);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setSubmitting(true);
    const r = await deletePayment(toDelete, tripId);
    setSubmitting(false);
    if (r.success) {
      toast.success("Pago eliminado");
      setToDelete(null);
      router.refresh();
    } else toast.error(r.error);
  };

  const handleStatusChange = async (id: number, next: PaymentStatus) => {
    const r = await updatePaymentStatus(id, tripId, next);
    if (r.success) {
      toast.success("Estado actualizado");
      router.refresh();
    } else toast.error(r.error);
  };

  return (
    <div className="cockpit-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <CircleDollarSign className="h-4 w-4 text-[var(--brand)]" />
          <h3 className="font-headline text-sm font-semibold">Pagos</h3>
          <Badge variant="brand">{payments.length}</Badge>
          {totalPaid > 0 && (
            <Badge variant="success" className="font-mono tabular-nums">
              ${totalPaid.toFixed(2)} pagado
            </Badge>
          )}
          {totalPending > 0 && (
            <Badge variant="warning" className="font-mono tabular-nums">
              ${totalPending.toFixed(2)} pendiente
            </Badge>
          )}
        </div>
        <Button variant="brand" size="sm" onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Registrar pago
        </Button>
      </div>

      {payments.length === 0 ? (
        <div className="p-8">
          <EmptyState title="Sin pagos" description="Registra los pagos asociados a este viaje." />
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {payments.map((p) => (
            <li key={p.paymentId} className="group flex items-center gap-3 px-4 py-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-muted/60 shrink-0">
                <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono tabular-nums font-semibold text-foreground">
                    ${p.amount.toFixed(2)}
                  </span>
                  <StatusPill status={STATUS_PILL_MAP[p.status]} size="sm" />
                  {p.paymentMethod && (
                    <Badge variant="outline" className="text-xs">
                      {PAYMENT_METHODS.find((m) => m.value === p.paymentMethod)?.label ??
                        p.paymentMethod}
                    </Badge>
                  )}
                  {p.paymentDate && (
                    <span className="font-mono tabular-nums text-xs text-muted-foreground">
                      {p.paymentDate}
                    </span>
                  )}
                </div>
                {p.notes && (
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.notes}</div>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8 opacity-60 group-hover:opacity-100">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => handleStatusChange(p.paymentId, "paid")}>
                    <CircleCheck className="h-4 w-4" /> Marcar pagado
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(p.paymentId, "pending")}>
                    <CircleAlert className="h-4 w-4" /> Marcar pendiente
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(p.paymentId, "cancelled")}>
                    <CircleX className="h-4 w-4" /> Cancelar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setToDelete(p.paymentId)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
              icon={CircleDollarSign}
              title="Registrar pago"
              description="Monto, método y estado del pago."
            />
          </DialogHeader>
          <div className="space-y-4">
            <FormSection icon={CircleDollarSign} title="Monto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Monto" icon={CircleDollarSign} required>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <Field label="Fecha" icon={CalendarDays}>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </Field>
              </div>
            </FormSection>
            <FormSection icon={CreditCard} title="Detalles">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Método" icon={CreditCard}>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Estado">
                  <Select value={status} onValueChange={(v) => setStatus(v as PaymentStatus)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="paid">Pagado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Notas" icon={FileText}>
                <Textarea
                  rows={2}
                  placeholder="Notas (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
              {submitting ? "Guardando…" : "Registrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
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
