import { NextResponse } from "next/server";
import { resolveApiKey } from "@/modules/webstore/lib/api-key";
import { webstoreCustomerUpsertSchema } from "@/modules/webstore/lib/schemas";
import { upsertWebstoreCustomer } from "@/modules/webstore/lib/upsert-customer";
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponseInit,
  WEBSTORE_RATE_LIMITS,
} from "@/modules/webstore/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const rawKey = authHeader?.replace(/^Bearer\s+/i, "");
  if (!rawKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(`customers:ip:${ip}`, WEBSTORE_RATE_LIMITS.authAttemptsPerIp);
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
  if (!apiKey.scopes.includes("manage_customers")) {
    return NextResponse.json(
      { error: "La API key no tiene permiso para gestionar clientes" },
      { status: 403 }
    );
  }

  const keyLimit = await checkRateLimit(
    `customers:key:${apiKey.apiKeyId}`,
    WEBSTORE_RATE_LIMITS.customersPerApiKey
  );
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

  const parsed = webstoreCustomerUpsertSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await upsertWebstoreCustomer(parsed.data, { apiKeyId: apiKey.apiKeyId });
    return NextResponse.json(
      { customerId: result.customerId, created: result.created },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    console.error("[webstore/customers] error registrando cliente:", error);
    return NextResponse.json({ error: "No se pudo registrar el cliente" }, { status: 500 });
  }
}
