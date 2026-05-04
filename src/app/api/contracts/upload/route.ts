import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN no configurado" },
      { status: 500 }
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (!session?.user?.id) {
          throw new Error("No autenticado");
        }
        return {
          allowedContentTypes: [...CONTRACT_ACCEPTED_MIME],
          maximumSizeInBytes: CONTRACT_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // No-op: la metadata se guarda en DB desde el cliente vía
        // createContract después de recibir la URL del blob.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error en upload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
