"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ImagePlus, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { DeliveryPhotoKind } from "@/generated/prisma";
import { DELIVERY_PHOTO_ACCEPT_ATTR, DELIVERY_PHOTOS_MAX } from "../../lib/schemas";
import { DELIVERY_PHOTO_KINDS, DELIVERY_PHOTO_KIND_LABELS } from "../../lib/photo-kinds";
import { draftFromFile, validatePhotoFile, type PhotoDraft } from "./photo-draft";

interface Props {
  value: PhotoDraft[];
  onChange: (next: PhotoDraft[]) => void;
  disabled?: boolean;
  /** Tope total, incluidas las fotos que ya existen fuera de este borrador. */
  max?: number;
  className?: string;
}

/** Miniatura que gestiona su propio object URL para no filtrar memoria. */
export function PhotoThumb({
  file,
  url,
  alt,
  sizes = "160px",
}: {
  file: File | null;
  url: string | null;
  alt: string;
  sizes?: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setObjectUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const src = objectUrl ?? url;
  if (!src) return <div className="absolute inset-0 bg-muted" />;
  return <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" unoptimized />;
}

export function DeliveryPhotosField({
  value,
  onChange,
  disabled,
  max = DELIVERY_PHOTOS_MAX,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(0, max - value.length);

  const handlePick = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const picked = Array.from(list);
    const accepted: PhotoDraft[] = [];
    for (const file of picked) {
      const error = validatePhotoFile(file);
      if (error) {
        toast.error(error);
        continue;
      }
      accepted.push(draftFromFile(file));
    }
    if (accepted.length > remaining) {
      toast.error(`Solo puedes agregar ${remaining} foto(s) más`);
      accepted.length = remaining;
    }
    if (accepted.length > 0) onChange([...value, ...accepted]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const update = (key: string, patch: Partial<PhotoDraft>) => {
    onChange(value.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  };

  const remove = (key: string) => onChange(value.filter((d) => d.key !== key));

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={DELIVERY_PHOTO_ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => handlePick(e.target.files)}
      />

      {value.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {value.map((d, index) => (
            <li
              key={d.key}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="relative aspect-square">
                <PhotoThumb
                  file={d.file}
                  url={d.url}
                  alt={d.caption || `Foto ${index + 1}`}
                />
                {d.file && (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-[var(--brand)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand-foreground)]">
                    Nueva
                  </span>
                )}
                <button
                  type="button"
                  aria-label="Quitar foto"
                  disabled={disabled}
                  onClick={() => remove(d.key)}
                  className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-destructive disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1.5 p-2">
                <Select
                  value={d.kind}
                  onValueChange={(v) => update(d.key, { kind: v as DeliveryPhotoKind })}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8 text-xs" aria-label="Tipo de foto">
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
                <Input
                  value={d.caption}
                  maxLength={160}
                  placeholder="Nota (opcional)"
                  aria-label="Nota de la foto"
                  disabled={disabled}
                  onChange={(e) => update(d.key, { caption: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || remaining === 0}
        >
          <ImagePlus className="h-4 w-4" /> Agregar fotos
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {value.length}/{max}
        </span>
      </div>
    </div>
  );
}
