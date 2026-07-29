# Diseño · Gestión de catálogo de tienda (webstore)

- **Fecha:** 2026-07-01
- **Módulo:** `webstore` (Tienda en línea)
- **Estado:** Aprobado (brainstorming)

## 1. Objetivo

Incorporar una vista dentro del módulo tienda que muestre los productos que se
están mostrando en la tienda en línea y permita gestionar, desde un solo lugar,
sus **precios**, **rebajas/ofertas** y **visibilidad** en el escaparate, con
**registro/control del historial de precios**.

## 2. Contexto actual (lo que ya existe)

- Módulo `webstore` con rutas `/webstore/ordenes` y `/webstore/api-keys`
  (id `"webstore"`, label "Tienda en línea", icon `Store`).
- `GET /api/webstore/products` ya expone el catálogo público
  (`webstoreEnabled = true, isActive = true`) con precio efectivo + stock.
- Motor de precios por capas centralizado en inventario:
  `getEffectivePrice(client, { productId, quantity, customerId?, at? })`
  → `{ basePrice, finalPrice, appliedDiscounts[] }`
  (`src/modules/inventory/lib/effective-price.ts`).
- Modelo `Discount` (percent | fixed | volume; por producto/categoría/cliente;
  `minQty`, `startsAt`, `endsAt`, `stackable`, `isActive`).
- Edición de producto auditada: `updateProduct` detecta cambio de precio y
  escribe `ProductPriceHistory` dentro de la transacción; lectura vía
  `getProductPriceHistoryAction(productId)`
  (`src/modules/inventory/actions/product-actions.ts`).
- UI de descuentos ya existe en inventario (`/(inventory)/discounts`).

**Brecha:** no hay una vista *centrada en la tienda* que filtre a los productos
del escaparate y unifique precio + rebajas + ofertas + visibilidad + historial.

## 3. Decisiones de diseño (con justificación)

1. **Precio = `salePrice` como fuente única de verdad.** No se crea un campo de
   "precio de tienda" separado. Un precio duplicado divergiría del precio usado
   en ventas/facturas y rompería el historial unificado (fuente clásica de
   descuadres, advertida en `CLAUDE.md`). Si en el futuro se requiere un precio
   online ≠ mostrador, el camino profesional es una **PriceList "Tienda"**
   (canal), que `getEffectivePrice` ya soporta — sin rehacer nada.
2. **Rebajas/ofertas = modelo `Discount` existente.** Una rebaja en el
   escaparate es un `Discount` activo; el storefront muestra `basePrice` tachado
   y `finalPrice`. Ambos valores ya los devuelve `getEffectivePrice`.
3. **"Oferta destacada" = flag de merchandising nuevo.** Se añade
   `Product.webstoreFeatured` (+ `webstoreSortOrder`) para curar qué productos se
   resaltan en el escaparate, independiente de que tengan o no descuento.
4. **Historial de precios = infraestructura existente.** Las ediciones de precio
   desde la tienda pasan por `updateProduct`, que ya registra
   `ProductPriceHistory`. Se expone un panel de historial por producto.
5. **Locking optimista en `Discount`.** Se añade `version Int` para editar
   descuentos concurrentemente sin pisar cambios (alineado con la regla de
   concurrencia de Neon: `UPDATE ... WHERE id=$1 AND version=$2 RETURNING`).
6. **Estructura = una sola página `/webstore/catalogo`** con edición inline y
   control de visibilidad, siguiendo la forma del módulo `pacas`.

## 4. Cambios de schema (`prisma/schema.prisma`, aplicados con `db push`)

```prisma
model Product {
  // ...campos existentes...
  webstoreFeatured  Boolean  @default(false) @map("webstore_featured")
  webstoreSortOrder Int?     @map("webstore_sort_order")
}

model Discount {
  // ...campos existentes...
  version Int @default(0)
}
```

- Son columnas simples → `db push` las aplica. No requieren CHECK/EXCLUDE ni
  matviews, por lo que no hay SQL crudo en `prisma/sql/`.
- Índice opcional para el escaparate:
  `@@index([webstoreEnabled, webstoreFeatured, webstoreSortOrder])`.

## 5. Backend (`src/modules/webstore/`)

### 5.1 Queries — `queries/catalog-queries.ts` (server-only, NO "use server")

- `getWebstoreCatalog(filters)` → filas del catálogo con:
  `productId, name, sku, category, imageUrl, isActive, webstoreEnabled,
  webstoreFeatured`, `salePrice` (base), precio efectivo (`basePrice`,
  `finalPrice`, `onSale`, `appliedDiscounts`) vía `getEffectivePrice`, stock
  disponible (suma de niveles). **Decimales serializados a `string`.**
  - Filtros: `search`, `category`, `status` (en tienda / oculto / todos),
    `onlyOnSale`, `onlyFeatured`.
- `getWebstoreCatalogKpis()` → productos en tienda, con oferta activa,
  destacados.

### 5.2 Actions — `actions/catalog-actions.ts` ("use server")

Todas devuelven `ActionResult<T>`, crean audit log dentro de la tx y llaman
`revalidatePath("/webstore/catalogo")`.

- `toggleWebstoreEnabled(productId, enabled)` — alta/baja del escaparate.
- `toggleWebstoreFeatured(productId, featured)` — oferta destacada.
- Edición de precio: **reutiliza `updateProduct`** (inventario) para preservar
  el historial automático; se envuelve una acción fina
  `updateWebstorePrice(productId, salePrice)` que delega en `updateProduct`.
- Gestión de descuentos por producto: **reutiliza `discount-actions`**
  (inventario). Se adapta el update de descuento para pasar/validar `version`.

### 5.3 Lib — `lib/schemas.ts`

- Schemas Zod para inputs de formularios (precio, toggle, filtros).

## 6. API

Extender `GET /api/webstore/products` (`src/app/api/webstore/products/route.ts`):

- Añadir por producto: `compareAtPrice` (= `basePrice` cuando hay rebaja, si no
  `null`) y `featured` (= `webstoreFeatured`), para que el storefront pinte el
  tachado y la sección de destacados. Ordenar destacados primero por
  `webstoreSortOrder`.

## 7. UI (`src/modules/webstore/components/`)

- `webstore-catalog-client.tsx` (cliente):
  - `PageHeader` "Catálogo de tienda" con acciones.
  - `KpiCard`s: en tienda · con oferta activa · destacados.
  - `MobileFilterSheet`: categoría, estado, con oferta, destacado, búsqueda.
  - `ResponsiveListView` (cards `<md`, tabla `>=md`). Por fila:
    imagen, nombre/SKU, categoría, **precio base y precio final** (rebaja con
    signo `−` (U+2212) y color, `font-mono tabular-nums`), stock,
    `StatusPill` (en tienda / oculto), badge "Destacado".
  - Acciones por fila: switch "en tienda", switch "destacado",
    editar precio (`ResponsiveFormDialog`), **historial de precios**
    (`ResponsiveFormDialog` con `getProductPriceHistoryAction`),
    gestionar descuentos (`ResponsiveFormDialog`).
  - `EmptyState` cuando no hay productos.
- Reglas: mobile-first (probar 375px), `prefers-reduced-motion`, sin emojis.

Página + layout:

- `src/app/(app)/(webstore)/webstore/catalogo/page.tsx` — carga
  `getWebstoreCatalog` + `getWebstoreCatalogKpis`.
- El `layout.tsx` del grupo ya hace `await requireModule("webstore")`.

## 8. Registro (`src/lib/module-registry.ts`)

Añadir en la entrada `webstore` la ruta:
`{ label: "Catálogo", href: "/webstore/catalogo", icon: <Tags/ShoppingBag> }`.

## 9. Verificación

- `pnpm prisma validate` + `pnpm prisma generate`.
- `npx tsc --noEmit`.
- `pnpm dev` → probar `/webstore/catalogo` en viewport 375px y desktop:
  toggle visibilidad/destacado, editar precio (aparece en historial),
  crear/editar descuento (rebaja visible en precio final), filtros.
- Confirmar que `GET /api/webstore/products` sigue respondiendo y expone
  `compareAtPrice`/`featured`.

## 10. Fuera de alcance (YAGNI)

- Storefront público / checkout (solo se exponen datos vía API).
- Códigos promocionales/cupones.
- Precio por canal (PriceList "Tienda") — se deja documentado como evolución.
- Multi-moneda en el cálculo de precio.
- Página global de auditoría de precios (se eligió panel por producto).

## 11. Riesgos

- **Concurrencia:** edición de descuentos usa `version` (locking optimista) con
  reintento corto ante stale; sin `SELECT FOR UPDATE` (Neon HTTP).
- **Serialización de `Decimal`:** siempre a `string`/`number` antes del cliente.
- **Reutilización cross-módulo:** las acciones de inventario (`updateProduct`,
  `discount-actions`) se invocan desde webstore; mantener contratos estables.
