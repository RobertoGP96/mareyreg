import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiKey } from "@/modules/webstore/lib/api-key";
import { getBaseCurrency } from "@/lib/currency";
import { getEffectiveLinePrices, lineKey } from "@/modules/inventory/lib/effective-price";
import { getDefaultWebstoreWarehouseId } from "@/modules/webstore/lib/dispatch-warehouse";
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponseInit,
  WEBSTORE_RATE_LIMITS,
} from "@/modules/webstore/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Catálogo de solo lectura para la tienda en línea: productos habilitados,
 * con precio efectivo (ya con descuentos activos aplicados), stock disponible
 * y foto — así la tienda no necesita su propia fuente de verdad para precio,
 * inventario ni hosting de imágenes.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const rawKey = authHeader?.replace(/^Bearer\s+/i, "");
  if (!rawKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(
    `products:ip:${ip}`,
    WEBSTORE_RATE_LIMITS.authAttemptsPerIp
  );
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
  if (!apiKey.scopes.includes("read_catalog")) {
    return NextResponse.json(
      { error: "La API key no tiene permiso para consultar el catálogo" },
      { status: 403 }
    );
  }

  const keyLimit = await checkRateLimit(
    `products:key:${apiKey.apiKeyId}`,
    WEBSTORE_RATE_LIMITS.productsPerApiKey
  );
  if (!keyLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes, intenta de nuevo más tarde" },
      rateLimitExceededResponseInit(keyLimit.retryAfterSeconds)
    );
  }

  const baseCurrency = await getBaseCurrency(db);
  const warehouseId = await getDefaultWebstoreWarehouseId(db);

  const products = await db.product.findMany({
    where: { webstoreEnabled: true, isActive: true },
    include: {
      stockLevels: warehouseId
        ? { where: { warehouseId }, select: { currentQuantity: true, currentPieces: true } }
        : { select: { currentQuantity: true, currentPieces: true }, take: 0 },
      presentations: {
        where: { isActive: true },
        select: {
          presentationId: true,
          sku: true,
          name: true,
          factor: true,
          retailPrice: true,
          wholesalePrice: true,
          barcode: true,
          isBase: true,
          piecesPerUnit: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ webstoreFeatured: "desc" }, { webstoreSortOrder: "asc" }, { name: "asc" }],
  });

  // getEffectiveLinePrices (no getEffectivePrices) porque solo esta variante
  // resuelve pricePerBase (precio por kg) para productos catch-weight — el
  // resto del catálogo usa basePrice/finalPrice de la presentación base
  // (line sin presentationId), igual comportamiento que antes.
  const prices = await getEffectiveLinePrices(
    db,
    products.map((p) => ({ productId: p.productId, quantity: 1 })),
    {}
  );

  const appliedDiscountIds = Array.from(
    new Set(
      Array.from(prices.values()).flatMap((p) => p.appliedDiscounts.map((d) => d.discountId))
    )
  );
  const discountsWithOffer = appliedDiscountIds.length
    ? await db.discount.findMany({
        where: { discountId: { in: appliedDiscountIds }, offerId: { not: null } },
        select: {
          discountId: true,
          offer: { select: { name: true, type: true, value: true, endsAt: true } },
        },
      })
    : [];
  const offerByDiscountId = new Map(
    discountsWithOffer
      .filter((d) => d.offer != null)
      .map((d) => [
        d.discountId,
        {
          name: d.offer!.name,
          type: d.offer!.type as "percent" | "fixed",
          value: Number(d.offer!.value),
          endsAt: d.offer!.endsAt ? d.offer!.endsAt.toISOString() : null,
        },
      ])
  );

  const catalog = products.map((p) => {
    const price = prices.get(lineKey(p.productId)) ?? {
      basePrice: 0,
      finalPrice: 0,
      appliedDiscounts: [],
      factor: 1,
      pricePerBase: undefined,
    };
    const appliedDiscountId = price.appliedDiscounts[0]?.discountId;
    const offer = appliedDiscountId != null ? offerByDiscountId.get(appliedDiscountId) ?? null : null;
    // Mismo almacén que usa processWebstoreOrder para despachar (ver
    // getDefaultWebstoreWarehouseId): así el stock mostrado nunca diverge
    // del stock realmente disponible para el despacho de esta orden.
    const stockAvailable = p.stockLevels.reduce((sum, s) => sum + Number(s.currentQuantity), 0);
    const stockPieces = p.stockLevels.reduce((sum, s) => sum + (s.currentPieces ?? 0), 0);
    // Precio por kg (solo productos catch-weight): fuente de verdad para
    // estimatedPrice de las presentaciones Pieza/Caja de este producto.
    const pricePerKg = p.isCatchWeight ? price.pricePerBase ?? null : null;
    return {
      sku: p.sku,
      name: p.name,
      description: p.description,
      category: p.category,
      price: price.finalPrice,
      compareAtPrice: price.finalPrice < price.basePrice ? price.basePrice : null,
      featured: p.webstoreFeatured,
      stockAvailable,
      imageUrl: p.imageUrl,
      offer,
      isCatchWeight: p.isCatchWeight,
      pricePerKg,
      presentations: p.presentations
        .filter((pr): pr is typeof pr & { sku: string } => pr.sku != null)
        .map((pr) => {
          const nominalWeightKg = p.isCatchWeight ? Number(pr.factor) : null;
          const estimatedPrice =
            p.isCatchWeight && pricePerKg != null && nominalWeightKg != null
              ? pricePerKg * nominalWeightKg
              : null;
          return {
            sku: pr.sku,
            name: pr.name,
            factor: Number(pr.factor),
            retailPrice: Number(pr.retailPrice),
            wholesalePrice: pr.wholesalePrice != null ? Number(pr.wholesalePrice) : null,
            barcode: pr.barcode,
            isBase: pr.isBase,
            piecesPerUnit: pr.piecesPerUnit,
            nominalWeightKg,
            estimatedPrice,
            stockPieces: p.isCatchWeight ? stockPieces : null,
          };
        }),
    };
  });

  return NextResponse.json({
    currency: {
      code: baseCurrency.code,
      symbol: baseCurrency.symbol,
      decimalPlaces: baseCurrency.decimalPlaces,
    },
    products: catalog,
  });
}
