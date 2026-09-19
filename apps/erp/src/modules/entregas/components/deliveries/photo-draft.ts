// Borrador de la galería en el cliente: mezcla fotos ya subidas (con `url`) y
// archivos pendientes (con `file`). Se convierte al formato del schema justo
// antes de enviar, subiendo los archivos a Blob en ese momento.
import { upload } from "@vercel/blob/client";
import type { DeliveryPhotoKind } from "@/generated/prisma";
import {
  DELIVERY_PHOTO_ACCEPTED_MIME,
  DELIVERY_PHOTO_MAX_BYTES,
  type DeliveryPhotoInput,
} from "../../lib/schemas";
import type { CashDeliveryPhotoRow } from "../../queries/cash-delivery-queries";

export type PhotoDraft = {
  key: string;
  photoId: number | null;
  url: string | null;
  file: File | null;
  kind: DeliveryPhotoKind;
  caption: string;
};

let seq = 0;
const nextKey = () => `photo-${Date.now()}-${seq++}`;

export function draftFromExisting(
  p: Pick<CashDeliveryPhotoRow, "photoId" | "url" | "kind" | "caption">
): PhotoDraft {
  return {
    key: `existing-${p.photoId}`,
    photoId: p.photoId,
    url: p.url,
    file: null,
    kind: p.kind,
    caption: p.caption ?? "",
  };
}

/** Foto única del modelo anterior: ya está en Blob pero aún no tiene fila. */
export function draftFromLegacyUrl(url: string): PhotoDraft {
  return { key: "legacy", photoId: null, url, file: null, kind: "receipt", caption: "" };
}

export function draftFromFile(file: File, kind: DeliveryPhotoKind = "receipt"): PhotoDraft {
  return { key: nextKey(), photoId: null, url: null, file, kind, caption: "" };
}

export function validatePhotoFile(file: File): string | null {
  if (!(DELIVERY_PHOTO_ACCEPTED_MIME as readonly string[]).includes(file.type)) {
    return `${file.name}: formato no admitido (JPG, PNG o WebP)`;
  }
  if (file.size > DELIVERY_PHOTO_MAX_BYTES) {
    return `${file.name}: supera los 5 MB`;
  }
  return null;
}

export async function uploadDeliveryPhotoFile(file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blob = await upload(`deliveries/${Date.now()}-${safeName}`, file, {
    access: "public",
    handleUploadUrl: "/api/deliveries/upload",
  });
  return blob.url;
}

/**
 * Sube los archivos pendientes (en orden, para que el progreso sea legible) y
 * devuelve la galería en el formato del schema. Lanza si alguna subida falla.
 */
export async function materializePhotoDrafts(drafts: PhotoDraft[]): Promise<DeliveryPhotoInput[]> {
  const out: DeliveryPhotoInput[] = [];
  for (const d of drafts) {
    const url = d.url ?? (d.file ? await uploadDeliveryPhotoFile(d.file) : null);
    if (!url) continue;
    out.push({ photoId: d.photoId, url, kind: d.kind, caption: d.caption.trim() || null });
  }
  return out;
}
