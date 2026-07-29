import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  DELIVERY_PHOTO_ACCEPTED_MIME,
  DELIVERY_PHOTO_MAX_BYTES,
} from "@/modules/envios/lib/schemas";

export const runtime = "nodejs";

/**
 * Upload directo cliente → Vercel Blob para la foto/comprobante de una entrega
 * de efectivo. Mismo patrón que /api/products/upload: el navegador pega aquí
 * para obtener un token firmado antes de subir el binario directo a Blob.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[deliveries/upload] BLOB_READ_WRITE_TOKEN no configurado");
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN no configurado en el servidor" },
      { status: 500 }
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch (e) {
    console.error("[deliveries/upload] body parse error:", e);
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        const userId = session?.user?.userId ?? session?.user?.id ?? null;
        if (!userId) {
          throw new Error("No autenticado. Recarga la página e inicia sesión.");
        }
        return {
          allowedContentTypes: [...DELIVERY_PHOTO_ACCEPTED_MIME],
          maximumSizeInBytes: DELIVERY_PHOTO_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: String(userId) }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("[deliveries/upload] completed", blob.url);
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error en upload";
    console.error("[deliveries/upload] handleUpload error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
