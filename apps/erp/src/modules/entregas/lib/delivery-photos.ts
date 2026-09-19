// Escritura de la galería de una entrega. Lo comparten crear, editar, marcar
// entregada y las acciones sueltas de fotos para que ninguna ruta se desvíe.
import type { Prisma } from "@/generated/prisma";
import { DELIVERY_PHOTOS_MAX, type DeliveryPhotoInput } from "./schemas";

type Tx = Prisma.TransactionClient;

function photoData(p: DeliveryPhotoInput) {
  return {
    url: p.url.trim(),
    kind: p.kind,
    caption: p.caption?.trim() || null,
  };
}

export async function assertPhotoCapacity(tx: Tx, deliveryId: number, adding: number) {
  const count = await tx.cashDeliveryPhoto.count({ where: { deliveryId } });
  if (count + adding > DELIVERY_PHOTOS_MAX) {
    throw new Error(`Máximo ${DELIVERY_PHOTOS_MAX} fotos por entrega`);
  }
}

/** Agrega fotos al final de la galería. Devuelve cuántas se escribieron. */
export async function appendPhotos(
  tx: Tx,
  deliveryId: number,
  photos: DeliveryPhotoInput[],
  userId: number
): Promise<number> {
  if (photos.length === 0) return 0;
  await assertPhotoCapacity(tx, deliveryId, photos.length);
  const last = await tx.cashDeliveryPhoto.aggregate({
    where: { deliveryId },
    _max: { sortOrder: true },
  });
  const start = (last._max.sortOrder ?? -1) + 1;
  await tx.cashDeliveryPhoto.createMany({
    data: photos.map((p, i) => ({
      deliveryId,
      ...photoData(p),
      sortOrder: start + i,
      uploadedById: userId,
    })),
  });
  return photos.length;
}

/**
 * Deja la galería exactamente como la envió el formulario: conserva (y
 * reordena) las fotos con `photoId`, crea las que no lo traen y elimina las
 * que ya no vienen. Devuelve las URLs eliminadas para limpiar el Blob DESPUÉS
 * del commit: borrar el binario dentro de la tx dejaría un hueco si esta falla.
 */
export async function syncPhotos(
  tx: Tx,
  deliveryId: number,
  photos: DeliveryPhotoInput[],
  userId: number
): Promise<{ removedUrls: string[] }> {
  if (photos.length > DELIVERY_PHOTOS_MAX) {
    throw new Error(`Máximo ${DELIVERY_PHOTOS_MAX} fotos por entrega`);
  }
  const existing = await tx.cashDeliveryPhoto.findMany({
    where: { deliveryId },
    select: { photoId: true, url: true },
  });
  const existingIds = new Set(existing.map((e) => e.photoId));
  const keepIds = new Set<number>();
  for (const p of photos) {
    if (p.photoId == null) continue;
    if (!existingIds.has(p.photoId)) {
      throw new Error("Una de las fotos ya no existe. Recarga e intenta de nuevo.");
    }
    keepIds.add(p.photoId);
  }

  const toRemove = existing.filter((e) => !keepIds.has(e.photoId));
  if (toRemove.length > 0) {
    await tx.cashDeliveryPhoto.deleteMany({
      where: { photoId: { in: toRemove.map((e) => e.photoId) } },
    });
  }

  for (const [index, p] of photos.entries()) {
    if (p.photoId != null) {
      await tx.cashDeliveryPhoto.update({
        where: { photoId: p.photoId },
        data: { kind: p.kind, caption: p.caption?.trim() || null, sortOrder: index },
      });
    } else {
      await tx.cashDeliveryPhoto.create({
        data: { deliveryId, ...photoData(p), sortOrder: index, uploadedById: userId },
      });
    }
  }

  return { removedUrls: toRemove.map((e) => e.url) };
}
