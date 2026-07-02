import { NextResponse } from "next/server";
import { getContractById } from "@/modules/carriers/queries/contract-queries";

export const runtime = "nodejs";

/**
 * Proxy para servir el archivo del contrato con headers que permiten
 * renderizado inline en iframe. Vercel Blob añade automáticamente
 * `Content-Security-Policy: default-src 'none'` a sus URLs públicas, lo
 * cual fuerza al navegador a descargar el PDF en vez de renderizarlo.
 *
 * Esta ruta hereda la protección del middleware de auth (cualquier
 * request sin sesión es redirigida a /login).
 *
 * Soporta `?download=1` para forzar attachment (botón Descargar) y
 * Range requests para que el visor PDF pueda hacer carga progresiva.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  const contractId = Number(id);
  if (!Number.isFinite(contractId) || contractId <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const contract = await getContractById(contractId);
  if (!contract) {
    return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  }

  const url = new URL(request.url);
  const wantsDownload = url.searchParams.get("download") === "1";

  // Repropagar el header Range para soportar carga progresiva del PDF.
  const upstreamHeaders = new Headers();
  const range = request.headers.get("range");
  if (range) upstreamHeaders.set("Range", range);

  let upstream: Response;
  try {
    upstream = await fetch(contract.fileUrl, {
      headers: upstreamHeaders,
      cache: "no-store",
    });
  } catch (e) {
    console.error("[contracts/file] upstream fetch failed:", e);
    return NextResponse.json({ error: "No se pudo obtener el archivo" }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    console.error("[contracts/file] upstream returned", upstream.status);
    return NextResponse.json(
      { error: `Origen respondió ${upstream.status}` },
      { status: 502 }
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? contract.fileMime);
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);

  const safeName = contract.fileName.replace(/"/g, "");
  headers.set(
    "Content-Disposition",
    `${wantsDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(safeName)}"`
  );
  headers.set("X-Content-Type-Options", "nosniff");
  // Cache corto del lado del cliente; Vercel Blob ya tiene su CDN al frente.
  headers.set("Cache-Control", "private, max-age=300, must-revalidate");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
