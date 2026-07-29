"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  DELIVERY_PHOTO_ACCEPT_ATTR,
  DELIVERY_PHOTO_MAX_BYTES,
} from "../../lib/schemas";

interface Props {
  file: File | null;
  existingUrl: string | null;
  onFileChange: (file: File | null) => void;
  onRemoveExisting: () => void;
  disabled?: boolean;
}

export function DeliveryPhotoField({
  file,
  existingUrl,
  onFileChange,
  onRemoveExisting,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // createObjectURL en el cuerpo del render fabricaría una URL nueva en cada
  // render y ninguna se liberaría.
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const previewUrl = objectUrl ?? existingUrl;

  const handlePick = (picked: File | undefined) => {
    if (!picked) return;
    if (picked.size > DELIVERY_PHOTO_MAX_BYTES) {
      toast.error("La foto supera los 5 MB");
      return;
    }
    onFileChange(picked);
  };

  const clear = () => {
    onFileChange(null);
    if (existingUrl) onRemoveExisting();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={DELIVERY_PHOTO_ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => handlePick(e.target.files?.[0])}
      />

      {previewUrl ? (
        <div className="flex items-center gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
            <Image
              src={previewUrl}
              alt="Comprobante de la entrega"
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={clear}
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" /> Quitar
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <ImagePlus className="h-4 w-4" /> Subir foto
        </Button>
      )}
    </div>
  );
}
