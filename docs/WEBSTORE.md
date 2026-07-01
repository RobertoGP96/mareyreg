# Módulo Tienda en línea (`webstore`) · Estado vivo

Capa de integración entre Mareyway y una tienda web externa (aún no construida): recibe ventas y pagos de esa tienda vía webhook, los refleja en el módulo de ventas existente (`SalesOrder`/`Invoice`), descuenta inventario, y expone un catálogo de solo lectura (precio, stock y foto) para que la tienda no necesite su propia fuente de verdad. Incluye además un sistema de precios y descuentos centralizado, usado por todos los canales de venta (POS, B2B y tienda en línea).

Plan completo de diseño: `C:/Users/usuario/.claude/plans/necesito-crear-un-modulo-rosy-adleman.md`

## Estado

| PR | Contenido | Estado |
|---|---|---|
| 1 | Schema (`WebstoreApiKey`, `WebstoreOrderLog`, enum `SalesChannel.online`, `Product.webstoreEnabled`, `ProductPriceHistory`, extensión de `Discount`) + SQL índice + registry + layout + placeholders | ✅ |
| 2 | Disponibilidad en tienda (`webstoreEnabled`) + historial de precios en Productos | ✅ |
| 3 | `getEffectivePrice` + CRUD de Descuentos (extiende el modelo `Discount` ya existente) | ✅ |
| 4 | Gestión de API keys de la tienda (crear/revocar, mostrar una vez) | ✅ |
| 5 | Endpoint `POST /api/webstore/orders` + `processWebstoreOrder` transaccional + idempotencia | ✅ |
| 6 | UI de bandeja de órdenes (dashboard, detalle, reasignación de línea, reprocesar) | ✅ |
| 7 | Foto de producto (Vercel Blob) + catálogo `GET /api/webstore/products` | ✅ |
| 8 | `getEffectivePrice` aplicado como precio sugerido en POS (B2B: sin UI de carrito propia todavía, pendiente cuando exista) | ✅ |
| 9 | Esta documentación | ✅ |
| — | Hardening (rate limiting del webhook, comparación automática precio-tienda-vs-Mareyway, HMAC de payload) | ⏳ v2 |

## Decisiones clave

- **Identificación de producto**: la tienda usa el `sku` de Mareyway directamente. No hay tabla de mapeo de códigos externos — si el `sku` no existe, está inactivo o no tiene `webstoreEnabled=true`, la orden completa queda en `needs_review` (todo o nada, dentro de una transacción).
- **Autoridad de precio**: Mareyway **nunca confía** en el `unitPrice` que manda la tienda (solo se guarda como referencia dentro de `rawPayload`). El precio real de cada línea se calcula con `getEffectivePrice`, que aplica el precio de lista del cliente (si tiene una asignada) y los `Discount` activos que correspondan.
- **Descuentos reutilizan el modelo `Discount` ya existente** (no se creó un `PromotionRule` paralelo). Se le agregaron 2 campos: `category` (scope por categoría cuando `productId` es null) y `stackable` (acumulable con otros descuentos activos). Regla de aplicación: si hay algún descuento no acumulable que aplica, se usa solo el de mayor descuento resultante; si todos los que aplican son acumulables, se suman (capados para no superar el precio base).
- **Idempotencia**: `WebstoreOrderLog.externalOrderId` es único. Un reintento del mismo POST devuelve el estado ya guardado (200 si `processed`, 409 si `error`/`needs_review`) en vez de reprocesar. El reproceso real solo ocurre vía la acción manual `reprocessOrder` desde la UI, tras corregir el problema (habilitar el producto, o reasignar manualmente qué producto usar para una línea puntual — corrección ad hoc, no persistida como mapeo global).
- **Auth del webhook**: Bearer API key (`WebstoreApiKey`, hash bcrypt) contra `/api/webstore/orders` y `/api/webstore/products`, excluidos del middleware de sesión de NextAuth (mismo patrón que `/api/contracts/upload`). Sin HMAC de payload en v1 — se documenta como mejora v2.
- **Precio sugerido en POS**: al agregar un producto al carrito, se dispara `getSuggestedUnitPriceAction` (envuelve `getEffectivePrice`) para pre-cargar el precio con descuento aplicado; el cajero conserva la posibilidad de editarlo manualmente (no se fuerza el precio, para no romper la flexibilidad de negociar precios en mostrador).
- **Foto de producto**: `Product.imageUrl` ya existía en el schema pero sin flujo de subida — se agregó `/api/products/upload` (mismo patrón Vercel Blob que `/api/contracts/upload`) y un selector de imagen en el formulario de Productos.

## Aplicar el módulo a la DB

```bash
# 1. Schema base (modelos, enums, índices)
pnpm prisma generate
pnpm db:push   # o el comando de push configurado en el repo

# 2. Índice parcial para la bandeja de atención
psql "$DATABASE_URL" -f prisma/sql/webstore-constraints.sql
```

## Recorrido funcional

1. **Productos** (`/products`): habilitar `webstoreEnabled` por producto (default `false`), cargar precio de venta y foto, ver historial de precios (timeline de solo lectura).
2. **Descuentos** (`/discounts`): crear reglas por producto, categoría o globales, con vigencia, cantidad mínima y si son acumulables. Aplican en todos los canales.
3. **API keys** (`/webstore/api-keys`): generar una key para la tienda (se muestra una sola vez), revocar cuando ya no se use.
4. **Webhook de órdenes** (`POST /api/webstore/orders`): la tienda manda `externalOrderId`, cliente, líneas (`sku`, `quantity`, `unitPrice` informativo) y pago opcional. Respuestas: `201` procesada, `200` ya procesada (idempotente), `202` requiere revisión manual, `400` payload inválido, `401` key inválida, `409` ya existe en error/revisión, `500` error interno.
5. **Catálogo de lectura** (`GET /api/webstore/products`): la tienda consulta sku, nombre, categoría, precio efectivo, stock disponible y foto de los productos habilitados.
6. **Bandeja de órdenes** (`/webstore/ordenes`): KPIs (recibidas hoy, requieren revisión, con error, procesadas hoy), lista filtrable por estado, detalle con payload crudo, líneas resueltas/sin resolver, movimientos de stock generados y botón "Reprocesar" (con reasignación de producto por línea cuando aplica).

## Riesgos / pendientes

- **Sin HMAC de payload**: v1 solo valida Bearer API key + TLS + idempotencia. Si la tienda queda expuesta públicamente sin control de quién le pega al webhook, considerar firma HMAC en v2.
- **Sin comparación automática de precio**: el `unitPrice` que manda la tienda se guarda en `rawPayload` pero no se compara contra el precio efectivo de Mareyway para detectar catálogos desincronizados — hoy solo sirve para diagnóstico manual.
- **Almacén por defecto**: si el payload no manda `warehouseId`, se usa el primer almacén activo por `warehouseId` ascendente. Si hay más de un almacén relevante para e-commerce, esto debería volverse configurable.
- **B2B sin UI de carrito propia**: `getEffectivePrice` está integrado en POS (precio sugerido, editable). B2B no tiene todavía una UI de creación de factura con líneas — cuando se construya, debe llamar `getEffectivePrice`/`getSuggestedUnitPriceAction` igual que POS.
- **Recalculo de precio por cantidad en POS**: el precio sugerido solo se calcula al agregar el producto al carrito; si el cajero cambia la cantidad después, no se recalcula automáticamente (relevante para descuentos por volumen). Mejora v2.

## Archivos clave

- Plan completo: ver path arriba.
- Schema: [prisma/schema.prisma](../prisma/schema.prisma) (secciones `WEBSTORE MODULE` y `PRICE LISTS + DISCOUNTS`).
- SQL manual: [prisma/sql/webstore-constraints.sql](../prisma/sql/webstore-constraints.sql).
- Registry: [src/lib/module-registry.ts](../src/lib/module-registry.ts).
- Layout: [src/app/(app)/(webstore)/layout.tsx](../src/app/(app)/(webstore)/layout.tsx).
- Helpers críticos:
  - [src/modules/inventory/lib/effective-price.ts](../src/modules/inventory/lib/effective-price.ts) — `getEffectivePrice`, única fuente de verdad del precio de venta.
  - [src/modules/webstore/lib/process-order.ts](../src/modules/webstore/lib/process-order.ts) — `processWebstoreOrder`, transacción completa (cliente, líneas, orden, factura, inventario, pago).
  - [src/modules/webstore/lib/api-key.ts](../src/modules/webstore/lib/api-key.ts) — generación/resolución de API keys.
  - [src/modules/webstore/lib/schemas.ts](../src/modules/webstore/lib/schemas.ts) — Zod del payload del webhook.
- Endpoints: [src/app/api/webstore/orders/route.ts](../src/app/api/webstore/orders/route.ts), [src/app/api/webstore/products/route.ts](../src/app/api/webstore/products/route.ts), [src/app/api/products/upload/route.ts](../src/app/api/products/upload/route.ts).
- Patrón a imitar para futuros módulos: [src/modules/pacas/](../src/modules/pacas/); patrón de descuento de inventario reutilizado desde [src/modules/sales/actions/invoice-actions.ts](../src/modules/sales/actions/invoice-actions.ts) (`dispatchLines`).
