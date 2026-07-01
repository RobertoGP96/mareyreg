import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiKey } from "@/modules/webstore/lib/api-key";
import { webstoreOrderPayloadSchema } from "@/modules/webstore/lib/schemas";
import { processWebstoreOrder, NeedsReviewError } from "@/modules/webstore/lib/process-order";
import type { Prisma } from "@/generated/prisma";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const rawKey = authHeader?.replace(/^Bearer\s+/i, "");
  if (!rawKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const apiKey = await resolveApiKey(rawKey);
  if (!apiKey) {
    return NextResponse.json({ error: "API key inválida o revocada" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = webstoreOrderPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const payload = parsed.data;

  const existing = await db.webstoreOrderLog.findUnique({
    where: { externalOrderId: payload.externalOrderId },
  });
  if (existing) {
    return NextResponse.json(
      {
        status: existing.status,
        logId: existing.logId,
        salesOrderId: existing.salesOrderId,
        invoiceId: existing.invoiceId,
      },
      { status: existing.status === "processed" ? 200 : 409 }
    );
  }

  const log = await db.webstoreOrderLog.create({
    data: {
      externalOrderId: payload.externalOrderId,
      apiKeyId: apiKey.apiKeyId,
      status: "received",
      rawPayload: payload as Prisma.InputJsonValue,
    },
  });

  try {
    const result = await processWebstoreOrder(log.logId, payload);
    return NextResponse.json({ status: "processed", logId: log.logId, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof NeedsReviewError) {
      await db.webstoreOrderLog.update({
        where: { logId: log.logId },
        data: { status: "needs_review", errorMessage: error.message },
      });
      return NextResponse.json(
        { status: "needs_review", logId: log.logId, unresolvedSkus: error.unresolvedSkus },
        { status: 202 }
      );
    }

    const message = error instanceof Error ? error.message : "Error interno al procesar la orden";
    console.error("[webstore/orders] error procesando orden:", error);
    await db.webstoreOrderLog.update({
      where: { logId: log.logId },
      data: { status: "error", errorMessage: message },
    });
    return NextResponse.json({ status: "error", logId: log.logId, error: message }, { status: 500 });
  }
}
