import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveApiKey } from "@/modules/webstore/lib/api-key";
import { getBaseCurrency } from "@/lib/currency";
import { getEffectiveLinePrices } from "@/modules/inventory/lib/effective-price";
import { getDefaultWebstoreWarehouseId } from "@/modules/webstore/lib/dispatch-warehouse";
import {
  catalogPriceLines,
  groupPiecesByProduct,
  toCatalogProduct,
  type WebstoreOfferPayload,
} from "@/modules/webstore/lib/catalog-mappers";
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

  const rows = await db.product.findMany({
    // sku no-null: el contrato de la tienda tipa sku como string (es la key de
    // React y el identificador de las líneas de orden) — un producto sin SKU
    // no puede venderse en línea y duplicaría keys en el catálogo.
    where: { webstoreEnabled: true, isActive: true, sku: { not: null } },
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
      modelGroup: { select: { groupId: true, name: true, optionLabel: true } },
    },
    orderBy: [{ webstoreFeatured: "desc" }, { webstoreSortOrder: "asc" }, { name: "asc" }],
  });
  const products = rows.filter((p): p is typeof p & { sku: string } => p.sku != null);

  // getEffectiveLinePrices (no getEffectivePrices) porque solo esta variante
  // resuelve pricePerBase (precio por kg) para catch-weight y el precio de
  // cada presentación no-base — el mismo número que factura process-order.
  const prices = await getEffectiveLinePrices(db, catalogPriceLines(products), {});

  // Pesajes disponibles (ProductPiece) de los productos catch-weight en el
  // almacén de la tienda: el cliente puede elegir la pieza exacta que quiere
  // y el pedido se factura con su peso real (sin awaiting_weighing).
  const catchWeightProductIds = products
    .filter((p) => p.isCatchWeight)
    .map((p) => p.productId);
  const availablePieces =
    warehouseId != null && catchWeightProductIds.length
      ? await db.productPiece.findMany({
          where: {
            productId: { in: catchWeightProductIds },
            warehouseId,
            status: "available",
          },
          orderBy: [{ weightKg: "asc" }, { pieceId: "asc" }],
          select: { pieceId: true, productId: true, weightKg: true, pieceCount: true },
        })
      : [];
  const piecesByProductId = groupPiecesByProduct(availablePieces);

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
  const offerByDiscountId = new Map<number, WebstoreOfferPayload>(
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

  // Mismo almacén que usa processWebstoreOrder para despachar (ver
  // getDefaultWebstoreWarehouseId): así el stock mostrado nunca diverge
  // del stock realmente disponible para el despacho de esta orden.
  const catalog = products.map((p) =>
    toCatalogProduct(p, {
      prices,
      offerByDiscountId,
      piecesByProductId,
      decimalPlaces: baseCurrency.decimalPlaces,
    })
  );

  return NextResponse.json({
    currency: {
      code: baseCurrency.code,
      symbol: baseCurrency.symbol,
      decimalPlaces: baseCurrency.decimalPlaces,
    },
    products: catalog,
  });
}
