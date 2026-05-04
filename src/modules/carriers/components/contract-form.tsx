"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
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
import { FormSection } from "@/components/ui/form-section";
import {
  FileText,
  UploadCloud,
  Calendar,
  Hash,
  Contact,
  Loader2,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createContract } from "../actions/contract-actions";
import type { ContractDriverOption } from "../queries/contract-queries";
import {
  CONTRACT_ACCEPT_ATTR,
  CONTRACT_ACCEPTED_MIME,
  CONTRACT_MAX_BYTES,
  isContractMime,
  type ContractStatus,
} from "../lib/schemas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drivers: ContractDriverOption[];
  presetDriverId?: number;
};

const STATUS_LABELS: Record<ContractStatus, string> = {
  active: "Activo",
  expired: "Expirado",
  cancelled: "Cancelado",
};

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

export function ContractForm({ open, onOpenChange, drivers, presetDriverId }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [driverId, setDriverId] = useState(presetDriverId ? String(presetDriverId) : "");
  const [contractNo, setContractNo] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<ContractStatus>("active");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const selectedDriver = useMemo(
    () => drivers.find((d) => String(d.driverId) === driverId) ?? null,
    [drivers, driverId],
  );

  useEffect(() => {
    if (presetDriverId) setDriverId(String(presetDriverId));
  }, [presetDriverId]);

  const reset = () => {
    setDriverId(presetDriverId ? String(presetDriverId) : "");
    setContractNo("");
    setStartDate("");
    setEndDate("");
    setStatus("active");
    setNotes("");
    setFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onFileChange = (f: File | null) => {
    if (!f) {
      setFile(null);
      setFileError(null);
      return;
    }
    if (f.size === 0) {
      setFileError("Archivo vacío");
      setFile(null);
      return;
    }
    if (f.size > CONTRACT_MAX_BYTES) {
      setFileError(`Máximo 10 MB (este pesa ${fmtBytes(f.size)})`);
      setFile(null);
      return;
    }
    if (!isContractMime(f.type)) {
      setFileError("Sólo PDF, DOC o DOCX");
      setFile(null);
      return;
    }
    setFileError(null);
    setFile(f);
  };

  const validate = (): string | null => {
    if (!driverId) return "Selecciona un conductor";
    if (!contractNo.trim()) return "Ingresa el folio del contrato";
    if (!startDate) return "Ingresa la fecha de inicio";
    if (endDate && new Date(endDate) < new Date(startDate))
      return "La fecha de fin no puede ser anterior al inicio";
    if (!file) return "Adjunta el archivo del contrato";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (!file) return;

    setSubmitting(true);
    setUploadProgress(0);

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const pathname = `contracts/driver-${driverId}/${contractNo.trim()}-${safeName}`;

      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/contracts/upload",
        contentType: file.type,
        onUploadProgress: (e) => setUploadProgress(Math.round(e.percentage)),
      });

      const r = await createContract({
        driverId: Number(driverId),
        contractNo: contractNo.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
        status,
        notes: notes.trim() || null,
        fileUrl: blob.url,
        fileName: file.name,
        fileMime: file.type,
        fileSize: file.size,
      });

      if (r.success) {
        toast.success("Contrato registrado");
        reset();
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al subir el archivo";
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      a11yTitle="Nuevo contrato"
      description="Registra un contrato y adjunta el documento (PDF, DOC o DOCX)."
      desktopMaxWidth="sm:max-w-2xl"
    >
      <FormDialogHeader
        icon={FileText}
        title="Nuevo contrato"
        description="Adjunta el documento y completa los datos del contrato."
      />

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <FormSection icon={Contact} title="Transportista">
          <Field label="Conductor" icon={Contact} required>
            <Select
              value={driverId}
              onValueChange={setDriverId}
              disabled={!!presetDriverId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={drivers.length ? "Selecciona conductor" : "Sin conductores activos"}
                />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.driverId} value={String(d.driverId)}>
                    {d.fullName} · {d.identificationNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {selectedDriver && (
            <div className="rounded-md bg-muted/30 px-3 py-2 ring-1 ring-inset ring-border text-xs">
              <div className="text-muted-foreground">Entidad</div>
              <div className="font-medium">{selectedDriver.entityName}</div>
            </div>
          )}
        </FormSection>

        <FormSection icon={Hash} title="Datos del contrato">
          <Field label="Folio" icon={Hash} required>
            <Input
              placeholder="CTR-2025-001"
              value={contractNo}
              onChange={(e) => setContractNo(e.target.value)}
              maxLength={80}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Inicio" icon={Calendar} required>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
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
                {(Object.keys(STATUS_LABELS) as ContractStatus[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {STATUS_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FormSection>
      </div>

      <div className="mt-4">
        <FormSection icon={UploadCloud} title="Documento">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "w-full rounded-md border-2 border-dashed px-4 py-6 text-sm transition-colors",
              "flex flex-col items-center justify-center gap-2 text-center",
              file
                ? "border-[var(--ops-success)]/40 bg-[var(--ops-success)]/5"
                : fileError
                  ? "border-destructive/50 bg-destructive/5"
                  : "border-border bg-muted/20 hover:bg-muted/40 hover:border-[var(--brand)]/40",
            )}
          >
            {file ? (
              <>
                <FileCheck2 className="h-7 w-7 text-[var(--ops-success)]" />
                <div className="font-medium truncate max-w-full">{file.name}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtBytes(file.size)} · Toca para reemplazar
                </div>
              </>
            ) : (
              <>
                <UploadCloud className="h-7 w-7 text-muted-foreground" />
                <div className="font-medium">Selecciona el archivo</div>
                <div className="text-xs text-muted-foreground">
                  PDF, DOC o DOCX · máximo 10 MB
                </div>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            accept={CONTRACT_ACCEPT_ATTR}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
          {fileError && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" /> {fileError}
            </div>
          )}
          <div className="text-[11px] text-muted-foreground">
            MIME aceptados: {CONTRACT_ACCEPTED_MIME.map((m) => m.split("/").pop()).join(", ")}.
          </div>
        </FormSection>
      </div>

      <div className="mt-3">
        <Field label="Notas">
          <Textarea
            rows={2}
            placeholder="Observaciones internas, condiciones, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="brand"
          onClick={handleSubmit}
          disabled={submitting || !file}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting
            ? uploadProgress > 0 && uploadProgress < 100
              ? `Subiendo… ${uploadProgress}%`
              : "Guardando…"
            : "Guardar contrato"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
