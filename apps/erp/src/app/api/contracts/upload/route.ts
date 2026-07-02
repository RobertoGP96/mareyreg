import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  CONTRACT_ACCEPTED_MIME,
  CONTRACT_MAX_BYTES,
} from "@/modules/carriers/lib/schemas";

export const runtime = "nodejs";

/**
 * Endpoint para upload directo cliente → Vercel Blob.
 * El navegador llama a `upload()` de `@vercel/blob/client`, que primero
 * pega aquí para obtener un token firmado. Validamos sesión y tipo de
 * archivo antes de generar el token; el binario nunca pasa por la
 * función (evita el límite de body de Server Actions / Functions).
 */
export async function POST(request: Request): Promise<NextResponse> {
  console.log("[contracts/upload] POST recibido");

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
    console.log(
      "[contracts/upload] body type:",
      (body as { type?: string }).type
    );
  } catch (e) {
    console.error("[contracts/upload] body parse error:", e);
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
        // Esta ruta está fuera del middleware de auth (ver auth.config.ts)
        // porque Vercel Blob hace callbacks server-to-server sin cookies.
        // Aquí (en la generación de token, que SÍ viene del navegador del
        // usuario) validamos la sesión.
        type SessionShape = { user?: { id?: string | number; userId?: string | number } } | null;
        let userId: string | number | null = null;
        try {
          const session = (await auth()) as SessionShape;
          userId = session?.user?.id ?? session?.user?.userId ?? null;
        } catch (authError) {
          console.warn("[contracts/upload] auth() falló:", authError);
        }
        console.log("[contracts/upload] onBeforeGenerateToken", {
          pathname,
          userId,
          hasClientPayload: !!clientPayload,
          multipart,
        });
        if (!userId) {
          throw new Error("No autenticado. Recarga la página e inicia sesión.");
        }
        return {
          allowedContentTypes: [...CONTRACT_ACCEPTED_MIME],
          maximumSizeInBytes: CONTRACT_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: String(userId) }),
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
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[contracts/upload] handleUpload error:", message, stack);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
