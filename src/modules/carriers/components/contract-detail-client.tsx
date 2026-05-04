"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Field, FormDialogHeader } from "@/components/ui/field";
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
  ArrowLeft,
  Download,
  SquarePen,
  Trash2,
  FileSignature,
  Calendar,
  User,
  Building2,
  Hash,
  Clock,
  CircleCheck,
  Hourglass,
  Ban,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ContractViewer } from "./contract-viewer";
import { deleteContract, updateContract } from "../actions/contract-actions";
import type { ContractDetail } from "../queries/contract-queries";
import type { ContractStatus } from "../lib/schemas";

type Props = { contract: ContractDetail };

const STATUS_LABEL: Record<ContractStatus, string> = {
  active: "Activo",
  expired: "Expirado",
  cancelled: "Cancelado",
};

const STATUS_TONE: Record<ContractStatus, string> = {
  active: "bg-[var(--ops-success)]/10 text-[var(--ops-success)] ring-[var(--ops-success)]/25",
  expired: "bg-[var(--ops-warning)]/12 text-[var(--ops-warning)] ring-[var(--ops-warning)]/30",
  cancelled: "bg-[var(--ops-critical)]/10 text-[var(--ops-critical)] ring-[var(--ops-critical)]/25",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const toDateInput = (iso: string) => iso.slice(0, 10);

function StatusPill({ status }: { status: ContractStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_TONE[status],
      )}
    >
      {status === "active" && <CircleCheck className="h-3.5 w-3.5" />}
      {status === "expired" && <Hourglass className="h-3.5 w-3.5" />}
      {status === "cancelled" && <Ban className="h-3.5 w-3.5" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

function MetaRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="font-medium truncate">{children}</div>
      </div>
    </div>
  );
}

export function ContractDetailClient({ contract }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [contractNo, setContractNo] = useState(contract.contractNo);
  const [startDate, setStartDate] = useState(toDateInput(contract.startDate));
  const [endDate, setEndDate] = useState(contract.endDate ? toDateInput(contract.endDate) : "");
  const [status, setStatus] = useState<ContractStatus>(contract.status);
  const [notes, setNotes] = useState(contract.notes ?? "");

  const handleSave = async () => {
    setSubmitting(true);
    const r = await updateContract(contract.contractId, {
      contractNo: contractNo.trim() || undefined,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate).toISOString() : null,
      status,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Contrato actualizado");
      setEditOpen(false);
      router.refresh();
    } else {
      toast.error(r.error);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    const r = await deleteContract(contract.contractId);
    setSubmitting(false);
    if (r.success) {
      toast.success("Contrato eliminado");
      router.push("/contracts");
    } else {
      toast.error(r.error);
    }
  };

  return (
    <>
      <PageHeader
        icon={FileSignature}
        title={contract.contractNo}
        description={`Contrato de ${contract.driverName}`}
        meta={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill status={contract.status} />
            <span className="text-xs text-muted-foreground">
              {fmtDate(contract.startDate)}
              {contract.endDate ? ` – ${fmtDate(contract.endDate)}` : ""}
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button asChild variant="outline" size="sm">
              <Link href="/contracts">
                <ArrowLeft className="h-4 w-4" /> Volver
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={contract.fileUrl} download={contract.fileName} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" /> Descargar
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <SquarePen className="h-4 w-4" /> Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
          </div>
        }
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <ContractViewer
          fileUrl={contract.fileUrl}
          fileName={contract.fileName}
          fileMime={contract.fileMime}
        />

        <aside className="rounded-md ring-1 ring-inset ring-border bg-card p-4 space-y-4 h-fit">
          <h2 className="text-sm font-semibold">Información</h2>
          <div className="space-y-3">
            <MetaRow icon={Hash} label="Folio">
              {contract.contractNo}
            </MetaRow>
            <MetaRow icon={User} label="Conductor">
              <Link
                href={`/drivers/${contract.driverId}`}
                className="hover:text-[var(--brand)] hover:underline"
              >
                {contract.driverName}
              </Link>
              <div className="text-xs text-muted-foreground font-normal">
                {contract.driverIdentification} · {contract.driverPhone}
              </div>
            </MetaRow>
            <MetaRow icon={Building2} label="Entidad">
              {contract.entityName}
            </MetaRow>
            <MetaRow icon={Calendar} label="Vigencia">
              {fmtDate(contract.startDate)}
              <div className="text-xs text-muted-foreground font-normal">
                {contract.endDate ? `Hasta ${fmtDate(contract.endDate)}` : "Sin fecha de fin"}
              </div>
            </MetaRow>
            <MetaRow icon={Clock} label="Registrado">
              {fmtDate(contract.createdAt)}
            </MetaRow>
            <MetaRow icon={Download} label="Archivo">
              <span className="truncate block">{contract.fileName}</span>
              <div className="text-xs text-muted-foreground font-normal">
                {contract.fileMime.split("/").pop()?.toUpperCase()} · {fmtBytes(contract.fileSize)}
              </div>
            </MetaRow>
          </div>
          {contract.notes && (
            <>
              <div className="border-t border-border pt-3">
                <div className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                  Notas
                </div>
                <p className="text-sm whitespace-pre-wrap">{contract.notes}</p>
              </div>
            </>
          )}
        </aside>
      </div>

      <ResponsiveFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        a11yTitle="Editar contrato"
        description="Actualiza los datos del contrato. El archivo no se puede reemplazar."
        desktopMaxWidth="sm:max-w-lg"
      >
        <FormDialogHeader
          icon={SquarePen}
          title="Editar contrato"
          description="Para reemplazar el archivo, elimina y crea uno nuevo."
        />
        <div className="space-y-3 mt-4">
          <Field label="Folio" icon={Hash} required>
            <Input value={contractNo} onChange={(e) => setContractNo(e.target.value)} maxLength={80} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Inicio" icon={Calendar} required>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Fin" icon={Calendar} hint="Opcional">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
            </Field>
          </div>
          <Field label="Estado">
            <Select value={status} onValueChange={(v) => setStatus(v as ContractStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABEL) as ContractStatus[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {STATUS_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notas">
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="brand" onClick={handleSave} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </ResponsiveFormDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán el folio <strong>{contract.contractNo}</strong> y el archivo
              adjunto de manera permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
