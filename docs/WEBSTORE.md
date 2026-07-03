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
| 10 | Ofertas (`WebstoreOffer` + materialización en `Discount`), badge/filtro "Ofertas" en la tienda, endpoint `POST /api/webstore/customers` y sincronización de perfil desde la tienda | ✅ |
| 11 (catch-weight) | Venta de productos de peso variable desde la tienda: precio/factura estimados por unidad, pesaje real y facturación en el ERP (`fulfillWebstoreOrder`) | ✅ |
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
4. **Webhook de órdenes** (`POST /api/webstore/orders`): la tienda manda `externalOrderId`, `currency` (ISO 4217, **requerido** desde la Fase 5 — sin default), cliente, líneas (`sku`, `quantity`, `unitPrice` informativo) y pago opcional. Respuestas: `201` procesada, `200` ya procesada (idempotente), `202` requiere revisión manual, `400` payload inválido — incluye tanto `currency` ausente/con formato Zod inválido (rechazado antes de crear el `WebstoreOrderLog`) como una moneda válida pero distinta a la base del ERP (rechazado dentro de `processWebstoreOrder`, con el log ya creado en estado `error`); el mensaje siempre indica cuál se esperaba, ej. `"Moneda no soportada: se recibió USD, se esperaba CUP"` — `401` key inválida, `409` ya existe en error/revisión, `500` error interno. El body de `201` ahora incluye `status: "processed" | "awaiting_weighing"` y `lines: { sku, priceIsEstimated, estimatedWeightKg? }[]` (ver sección "Peso variable" abajo).

   > **Nota para integradores externos (v2 de este contrato, jul 2026)**: `currency` pasó de opcional (default `"USD"`) a **obligatorio**, y debe coincidir exactamente con la moneda base configurada en el ERP (`getBaseCurrency`, hoy `CUP`). Un valor distinto lanza `UnsupportedCurrencyError` (`process-order.ts`) y el endpoint responde `400 { status: "error", logId, error: "Moneda no soportada: se recibió X, se esperaba CUP" }` — no es un `NeedsReviewError` (no llega a intentar resolver SKUs) ni un `500` (no es un error interno, es payload incorrecto). Los pagos (`InvoicePayment`) que registra `processWebstoreOrder` quedan siempre en moneda base (`currencyId`/`amountTendered`/`exchangeRate` en `null`), por convención — nunca en la moneda "entregada" del payload.
5. **Catálogo de lectura** (`GET /api/webstore/products`): la tienda consulta sku, nombre, categoría, precio efectivo, stock disponible, foto y oferta vigente (si aplica) de los productos habilitados. Desde la Fase 5 (multi-moneda) la respuesta es un envelope `{ currency, products }` en vez de un array desnudo:

   ```ts
   {
     currency: { code: string; symbol: string; decimalPlaces: number }; // moneda BASE del ERP (getBaseCurrency), ej. { code: "CUP", symbol: "$", decimalPlaces: 0 }
     products: WebstoreProduct[];
   }
   ```

   Todos los montos (`price`, `compareAtPrice`, `pricePerKg`, `presentations[].retailPrice/wholesalePrice/estimatedPrice`) ya vienen convertidos y redondeados a la moneda base — la tienda **nunca** convierte ni conoce tasas de cambio, solo muestra `currency` tal cual la declara el ERP. Cada producto incluye además:

   ```ts
   offer: { name: string; type: "percent" | "fixed"; value: number; endsAt: string | null } | null
   isCatchWeight: boolean
   pricePerKg: number | null // solo si isCatchWeight
   ```

   `offer` refleja la `WebstoreOffer` que generó el `Discount` aplicado al precio del producto (null si no tiene ninguno vigente). El `%` que muestra el badge de la tienda se calcula siempre desde `price`/`compareAtPrice` (funciona igual para ofertas `percent` y `fixed`); `offer.name` y `offer.endsAt` son solo para el mensaje descriptivo en el detalle de producto. Cada presentación (`presentations[]`) agrega, solo quando `isCatchWeight`: `piecesPerUnit`, `nominalWeightKg` (factor — peso nominal, solo estimación), `estimatedPrice` (`pricePerKg × nominalWeightKg`) y `stockPieces`.
6. **Bandeja de órdenes** (`/webstore/ordenes`): KPIs (recibidas hoy, requieren revisión, con error, procesadas hoy), lista filtrable por estado (incluye "Por pesar" para `awaiting_weighing`), detalle con payload crudo, líneas resueltas/sin resolver, movimientos de stock generados, botón "Reprocesar" (con reasignación de producto por línea cuando aplica) y, para pedidos `awaiting_weighing`, formulario de pesaje (ver abajo).
7. **Clientes** (`POST /api/webstore/customers`): la tienda registra o actualiza un cliente en el ERP al crear/editar el perfil local (registro y "Mis datos"), sin login con contraseña. Requiere API key con scope `manage_customers`. Body:

   ```ts
   { name: string; phone: string; email?: string; address?: string }
   ```

   (`name` mínimo 1 carácter, `phone` mínimo 5). Respuestas: `201 { customerId, created: true }` (cliente nuevo), `200 { customerId, created: false }` (match por teléfono/email existente, idempotente), `400 { error, details }` (payload inválido), `401`/`403` (key inválida o sin el scope), `429` (rate limit), `500 { error }`. La tienda trata esta llamada como **best-effort**: si falla por cualquier motivo, el perfil/registro local de la tienda se guarda igual (ver `syncProfile` en `apps/tienda/src/app/actions/customer-actions.ts`).

## Peso variable (catch-weight) en la tienda

- **Venta por unidad, precio estimado**: la tienda vende productos catch-weight por pieza/caja (presentación con `piecesPerUnit`), nunca por peso. El precio mostrado (`estimatedPrice` en el catálogo) es `pricePerKg × nominalWeightKg` — una estimación. El peso real solo se conoce al pesar en báscula.
- **`POST /api/webstore/orders` no cambia de payload**: sigue mandando `sku` + `quantity` entera (sin campo de peso). Si el pedido contiene al menos una línea de un producto `isCatchWeight`, `processWebstoreOrder` (`src/modules/webstore/lib/process-order.ts`) crea el `SalesOrder` con montos **estimados** (factor nominal, no peso real) pero **NO crea `Invoice` ni descuenta stock** — el `WebstoreOrderLog` queda en `awaiting_weighing`. Pedidos sin líneas catch-weight siguen el flujo de siempre (factura + descuento de stock inmediatos).
- **Pesaje y facturación** (`fulfillWebstoreOrder`, `src/modules/webstore/actions/fulfill-order-actions.ts`): quien procesa el pedido en el ERP captura el peso real (kg) de cada línea catch-weight desde `/webstore/ordenes/[id]`. La acción exige un peso `> 0` por cada línea, crea la `Invoice` real (`dispatchLines` con `actualWeightKg`, que sí descuenta stock/valuación/kardex en kg reales), corrige `SalesOrderLine`/`SalesOrder` a los montos reales y marca el log `processed`. Es idempotente: solo una llamada gana el claim atómico (`status: "awaiting_weighing" → "received"`); una segunda llamada devuelve "El pedido ya fue procesado".
- **Sin factura estimada ni ajustes posteriores**: por decisión de producto, no se genera ninguna factura previa con montos estimados — la única `Invoice` del pedido es la que crea `fulfillWebstoreOrder` con el peso real.
- **UI de la tienda**: precio marcado como "Precio estimado" en detalle de producto, carrito y resumen de checkout cuando el producto/línea es catch-weight; la confirmación de pedido (`/pedido-confirmado?status=awaiting_weighing`) avisa que el total puede variar ligeramente.

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
  - [src/modules/webstore/lib/process-order.ts](../src/modules/webstore/lib/process-order.ts) — `processWebstoreOrder`, transacción completa (cliente, líneas, orden, factura, inventario, pago); pedidos con líneas catch-weight quedan `awaiting_weighing` sin factura ni descuento de stock.
  - [src/modules/webstore/actions/fulfill-order-actions.ts](../src/modules/webstore/actions/fulfill-order-actions.ts) — `fulfillWebstoreOrder`, pesaje real + facturación de pedidos `awaiting_weighing`.
  - [src/modules/webstore/lib/api-key.ts](../src/modules/webstore/lib/api-key.ts) — generación/resolución de API keys.
  - [src/modules/webstore/lib/schemas.ts](../src/modules/webstore/lib/schemas.ts) — Zod del payload del webhook.
- Endpoints: [src/app/api/webstore/orders/route.ts](../src/app/api/webstore/orders/route.ts), [src/app/api/webstore/products/route.ts](../src/app/api/webstore/products/route.ts), [src/app/api/webstore/customers/route.ts](../src/app/api/webstore/customers/route.ts), [src/app/api/products/upload/route.ts](../src/app/api/products/upload/route.ts).
- Patrón a imitar para futuros módulos: [src/modules/pacas/](../src/modules/pacas/); patrón de descuento de inventario reutilizado desde [src/modules/sales/actions/invoice-actions.ts](../src/modules/sales/actions/invoice-actions.ts) (`dispatchLines`).
- Scope de API key `manage_customers`: [src/modules/webstore/lib/api-key-scopes.ts](../src/modules/webstore/lib/api-key-scopes.ts) (necesario para `POST /api/webstore/customers`).
- Lado tienda (`apps/tienda/`, consume todo vía HTTP — nunca importa código del ERP):
  - [apps/tienda/src/lib/erp-client.ts](../apps/tienda/src/lib/erp-client.ts) — `WebstoreProductOffer`, campo `offer` en `WebstoreProduct`, `upsertCustomer()`.
  - [apps/tienda/src/app/actions/customer-actions.ts](../apps/tienda/src/app/actions/customer-actions.ts) — `syncProfile`, best-effort (nunca lanza).
  - [apps/tienda/src/app/registro/page.tsx](../apps/tienda/src/app/registro/page.tsx), [apps/tienda/src/app/perfil/datos/page.tsx](../apps/tienda/src/app/perfil/datos/page.tsx) — puntos donde se llama `syncProfile`.
  - [apps/tienda/src/app/catalogo/catalog-client.tsx](../apps/tienda/src/app/catalogo/catalog-client.tsx) — chip "Ofertas" (`?ofertas=1`) filtrando por `compareAtPrice != null`.
