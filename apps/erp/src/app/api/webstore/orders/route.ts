import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiKey } from "@/modules/webstore/lib/api-key";
import { webstoreOrderPayloadSchema } from "@/modules/webstore/lib/schemas";
import {
  processWebstoreOrder,
  NeedsReviewError,
  UnsupportedCurrencyError,
} from "@/modules/webstore/lib/process-order";
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponseInit,
  WEBSTORE_RATE_LIMITS,
} from "@/modules/webstore/lib/rate-limit";
import { Prisma } from "@/generated/prisma";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const rawKey = authHeader?.replace(/^Bearer\s+/i, "");
  if (!rawKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(`orders:ip:${ip}`, WEBSTORE_RATE_LIMITS.authAttemptsPerIp);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes, intenta de nuevo más tarde" },
      rateLimitExceededResponseInit(ipLimit.retryAfterSeconds)
    );
  }

  const apiKey = await resolveApiKey(rawKey);
  if (!apiKey) {
    return NextResponse.json({ error: "API key inválida o revocada" }, { status: 401 });
  }
  if (!apiKey.scopes.includes("create_orders")) {
    return NextResponse.json(
      { error: "La API key no tiene permiso para crear órdenes" },
      { status: 403 }
    );
  }

  const keyLimit = await checkRateLimit(`orders:key:${apiKey.apiKeyId}`, WEBSTORE_RATE_LIMITS.ordersPerApiKey);
  if (!keyLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes, intenta de nuevo más tarde" },
      rateLimitExceededResponseInit(keyLimit.retryAfterSeconds)
    );
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

  let log;
  try {
    log = await db.webstoreOrderLog.create({
      data: {
        externalOrderId: payload.externalOrderId,
        apiKeyId: apiKey.apiKeyId,
        status: "received",
        rawPayload: payload as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      (error.meta?.target as string[] | undefined)?.includes("external_order_id")
    ) {
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
    }
    console.error("[webstore/orders] error creando el registro de la orden:", error);
    return NextResponse.json({ error: "Error interno al procesar la orden" }, { status: 500 });
  }

  try {
    const result = await processWebstoreOrder(log.logId, payload, undefined, {
      apiKeyId: apiKey.apiKeyId,
    });
    return NextResponse.json({ logId: log.logId, ...result }, { status: 201 });
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

    if (error instanceof UnsupportedCurrencyError) {
      // Error del integrador (payload mal formado), no interno: 400 en vez
      // de 500, con el mensaje explícito de qué moneda se esperaba.
      await db.webstoreOrderLog.update({
        where: { logId: log.logId },
        data: { status: "error", errorMessage: error.message },
      });
      return NextResponse.json(
        { status: "error", logId: log.logId, error: error.message },
        { status: 400 }
      );
    }

    console.error("[webstore/orders] error procesando orden:", error);
    const message = "Error interno al procesar la orden";
    await db.webstoreOrderLog.update({
      where: { logId: log.logId },
      data: { status: "error", errorMessage: message },
    });
    return NextResponse.json({ status: "error", logId: log.logId, error: message }, { status: 500 });
  }
}
