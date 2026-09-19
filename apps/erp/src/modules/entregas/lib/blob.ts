import { del } from "@vercel/blob";

const BLOB_HOST = "blob.vercel-storage.com";

/**
 * Borra binarios del Blob tras eliminar sus filas. Best-effort y fuera de la
 * transacción: la fila ya no existe, así que un fallo aquí solo deja un
 * archivo huérfano (barato) en vez de una entrega inconsistente (caro).
 */
export async function deleteBlobsQuietly(urls: string[]): Promise<void> {
  const targets = urls.filter((u) => {
    try {
      return new URL(u).hostname.endsWith(BLOB_HOST);
    } catch {
      return false;
    }
  });
  if (targets.length === 0 || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(targets);
  } catch (error) {
    console.error("deleteBlobsQuietly:", error);
  }
}
