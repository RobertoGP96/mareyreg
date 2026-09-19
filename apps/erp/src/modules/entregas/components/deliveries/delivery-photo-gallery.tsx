"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Field, FormDialogHeader } from "@/components/ui/field";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Camera, ImagePlus, Loader2, MoreHorizontal, Pencil, Trash2, ExternalLink,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { DeliveryPhotoKind } from "@/generated/prisma";
import { DELIVERY_PHOTOS_MAX, type DeliveryPhotoInput, type DeliveryPhotoMetaInput } from "../../lib/schemas";
import { DELIVERY_PHOTO_KINDS, DELIVERY_PHOTO_KIND_LABELS } from "../../lib/photo-kinds";
import type { CashDeliveryPhotoRow } from "../../queries/cash-delivery-queries";
import { DeliveryPhotosField } from "./delivery-photos-field";
import { materializePhotoDrafts, type PhotoDraft } from "./photo-draft";

export type GalleryActions = {
  canAdd: boolean;
  canRemove: (photo: CashDeliveryPhotoRow) => boolean;
  onAdd: (photos: DeliveryPhotoInput[]) => Promise<boolean>;
  onUpdate: (photoId: number, meta: DeliveryPhotoMetaInput) => Promise<boolean>;
  onRemove: (photoId: number) => Promise<boolean>;
};

interface Props {
  photos: CashDeliveryPhotoRow[];
  legacyPhotoUrl: string | null;
  actions?: GalleryActions;
  className?: string;
}

const KIND_TONE: Record<DeliveryPhotoKind, string> = {
  receipt: "bg-[var(--ops-success)]/15 text-[var(--ops-success)]",
  id_document: "bg-[var(--ops-active)]/15 text-[var(--ops-active)]",
  other: "bg-muted text-muted-foreground",
};

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleString("es-MX", {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function openPhoto(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function DeliveryPhotoGallery({ photos, legacyPhotoUrl, actions, className }: Props) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CashDeliveryPhotoRow | null>(null);
  const [removing, setRemoving] = useState<CashDeliveryPhotoRow | null>(null);
  const [busy, setBusy] = useState(false);

  const total = photos.length + (legacyPhotoUrl ? 1 : 0);
  const canAdd = !!actions?.canAdd && total < DELIVERY_PHOTOS_MAX;

  const handleRemove = async () => {
    if (!removing || !actions) return;
    setBusy(true);
    try {
      const ok = await actions.onRemove(removing.photoId);
      if (ok) setRemoving(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Camera className="h-3.5 w-3.5" /> Fotos
          <span className="tabular-nums">({total})</span>
        </h3>
        {canAdd && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            <ImagePlus className="h-4 w-4" /> Agregar
          </Button>
        )}
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
          <Camera className="mx-auto h-6 w-6 text-muted-foreground/50" />
          <p className="mt-2 text-xs text-muted-foreground">
            Sin fotos todavía.
            {canAdd ? " Adjunta el comprobante o una foto del lugar." : ""}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {legacyPhotoUrl && (
            <li className="overflow-hidden rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => openPhoto(legacyPhotoUrl)}
                className="relative block aspect-square w-full"
                aria-label="Abrir foto"
              >
                <Image
                  src={legacyPhotoUrl}
                  alt="Comprobante"
                  fill
                  sizes="(max-width: 640px) 50vw, 200px"
                  className="object-cover"
                  unoptimized
                />
                <span className={cn("absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold", KIND_TONE.receipt)}>
                  Comprobante
                </span>
              </button>
              <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Registro anterior</p>
            </li>
          )}
          {photos.map((p) => (
            <li key={p.photoId} className="overflow-hidden rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => openPhoto(p.url)}
                className="relative block aspect-square w-full"
                aria-label={`Abrir foto: ${DELIVERY_PHOTO_KIND_LABELS[p.kind]}`}
              >
                <Image
                  src={p.url}
                  alt={p.caption || DELIVERY_PHOTO_KIND_LABELS[p.kind]}
                  fill
                  sizes="(max-width: 640px) 50vw, 200px"
                  className="object-cover"
                  unoptimized
                />
                <span className={cn("absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold", KIND_TONE[p.kind])}>
                  {DELIVERY_PHOTO_KIND_LABELS[p.kind]}
                </span>
              </button>
              <div className="flex items-start justify-between gap-1 px-2 py-1.5">
                <div className="min-w-0">
                  {p.caption && (
                    <p className="truncate text-xs text-foreground" title={p.caption}>
                      {p.caption}
                    </p>
                  )}
                  <p className="truncate text-[11px] text-muted-foreground tabular-nums">
                    {p.uploadedByName ? `${p.uploadedByName} · ` : ""}
                    {fmtDate(p.createdAt)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Opciones de la foto">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => openPhoto(p.url)}>
                      <ExternalLink className="h-4 w-4" /> Abrir
                    </DropdownMenuItem>
                    {actions && (
                      <DropdownMenuItem onClick={() => setEditing(p)}>
                        <Pencil className="h-4 w-4" /> Editar tipo y nota
                      </DropdownMenuItem>
                    )}
                    {actions?.canRemove(p) && (
                      <DropdownMenuItem
                        onClick={() => setRemoving(p)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" /> Quitar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      {actions && (
        <AddPhotosDialog
          open={adding}
          onOpenChange={setAdding}
          remaining={Math.max(0, DELIVERY_PHOTOS_MAX - total)}
          onAdd={actions.onAdd}
        />
      )}

      {actions && (
        <EditPhotoDialog
          photo={editing}
          onOpenChange={(o) => !o && setEditing(null)}
          onSave={actions.onUpdate}
        />
      )}

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar esta foto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará de la galería de la entrega. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busy ? "Quitando…" : "Quitar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function AddPhotosDialog({
  open,
  onOpenChange,
  remaining,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remaining: number;
  onAdd: (photos: DeliveryPhotoInput[]) => Promise<boolean>;
}) {
  const [drafts, setDrafts] = useState<PhotoDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) setDrafts([]);
  }, [open]);

  const handleSubmit = async () => {
    if (drafts.length === 0) {
      toast.error("Selecciona al menos una foto");
      return;
    }
    setSubmitting(true);
    try {
      let photos: DeliveryPhotoInput[];
      setUploading(true);
      try {
        photos = await materializePhotoDrafts(drafts);
      } catch (e) {
        console.error("gallery upload:", e);
        toast.error("No se pudieron subir las fotos");
        return;
      } finally {
        setUploading(false);
      }
      const ok = await onAdd(photos);
      if (ok) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      a11yTitle="Agregar fotos"
      description="Comprobante, identificación u otras fotos de la entrega."
      desktopMaxWidth="sm:max-w-lg"
    >
      <FormDialogHeader
        icon={ImagePlus}
        title="Agregar fotos"
        description="Comprobante, identificación u otras fotos de la entrega."
      />
      <div className="mt-4">
        <Field label="Fotos" icon={Camera} hint="JPG, PNG o WebP, máx. 5 MB cada una.">
          <DeliveryPhotosField
            value={drafts}
            onChange={setDrafts}
            disabled={submitting}
            max={remaining}
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="button" variant="brand" onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? (uploading ? "Subiendo…" : "Guardando…") : "Agregar"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}

function EditPhotoDialog({
  photo,
  onOpenChange,
  onSave,
}: {
  photo: CashDeliveryPhotoRow | null;
  onOpenChange: (open: boolean) => void;
  onSave: (photoId: number, meta: DeliveryPhotoMetaInput) => Promise<boolean>;
}) {
  const [kind, setKind] = useState<DeliveryPhotoKind>("receipt");
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (photo) {
      setKind(photo.kind);
      setCaption(photo.caption ?? "");
    }
  }, [photo]);

  const handleSave = async () => {
    if (!photo) return;
    setSubmitting(true);
    try {
      const ok = await onSave(photo.photoId, { kind, caption: caption.trim() || null });
      if (ok) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveFormDialog
      open={!!photo}
      onOpenChange={onOpenChange}
      a11yTitle="Editar foto"
      description="Tipo y nota de la foto."
      desktopMaxWidth="sm:max-w-md"
    >
      <FormDialogHeader icon={Pencil} title="Editar foto" description="Tipo y nota de la foto." />
      <div className="mt-4 space-y-4">
        {photo && (
          <div className="relative h-40 w-full overflow-hidden rounded-lg border border-border">
            <Image
              src={photo.url}
              alt={photo.caption || DELIVERY_PHOTO_KIND_LABELS[photo.kind]}
              fill
              sizes="(max-width: 640px) 100vw, 400px"
              className="object-cover"
              unoptimized
            />
          </div>
        )}
        <Field label="Tipo">
          <Select value={kind} onValueChange={(v) => setKind(v as DeliveryPhotoKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DELIVERY_PHOTO_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {DELIVERY_PHOTO_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Nota">
          <Input
            value={caption}
            maxLength={160}
            placeholder="Ej. Firmado por el destinatario"
            onChange={(e) => setCaption(e.target.value)}
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="button" variant="brand" onClick={handleSave} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}

export function PhotoKindBadge({ kind }: { kind: DeliveryPhotoKind }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", KIND_TONE[kind])}>
      {DELIVERY_PHOTO_KIND_LABELS[kind]}
    </Badge>
  );
}
