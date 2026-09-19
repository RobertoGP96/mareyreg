import type { DeliveryPhotoKind } from "@/generated/prisma";

export const DELIVERY_PHOTO_KINDS = ["receipt", "id_document", "other"] as const;

export const DELIVERY_PHOTO_KIND_LABELS: Record<DeliveryPhotoKind, string> = {
  receipt: "Comprobante",
  id_document: "Identificación",
  other: "Otra",
};
