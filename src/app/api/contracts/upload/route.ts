import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/audit";
import {
  CONTRACT_ACCEPTED_MIME,
  CONTRACT_MAX_BYTES,
} from "@/modules/carriers/lib/schemas";

/**
 * Endpoint para upload directo cliente → Vercel Blob.
 * El navegador llama a `upload()` de `@vercel/blob/client`, que primero
 * pega aquí para obtener un token firmado. Validamos sesión y tipo de
 * archivo antes de generar el token; el binario nunca pasa por la
 * función (evita el límite de body de Server Actions / Functions).
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[contracts/upload] BLOB_READ_WRITE_TOKEN no configurado");
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN no configurado en el servidor" },
      { status: 500 }
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch (e) {
    console.error("[contracts/upload] body parse error:", e);
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const userId = await getCurrentUserId();
        if (!userId) {
          console.warn(
            `[contracts/upload] sin sesión activa al solicitar token (${pathname})`
          );
          throw new Error("Sesión expirada. Recarga la página e inicia sesión.");
        }
        return {
          allowedContentTypes: [...CONTRACT_ACCEPTED_MIME],
          maximumSizeInBytes: CONTRACT_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log(
          "[contracts/upload] completed",
          blob.url,
          tokenPayload ? JSON.parse(tokenPayload) : null
        );
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error en upload";
    console.error("[contracts/upload] handleUpload error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
