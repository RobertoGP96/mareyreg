# Catálogo de tienda (webstore) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una vista `/webstore/catalogo` para gestionar, desde el módulo tienda, los productos del escaparate: precio (con historial), rebajas/ofertas (`Discount` + "oferta destacada"), y visibilidad.

**Architecture:** Server page (fetch) → client component (render) siguiendo el patrón `ordenes/page.tsx` → `OrderInboxClient`. El precio sigue siendo `salePrice` (fuente única); las ediciones de precio delegan en `updateProduct` (que ya audita `ProductPriceHistory`). Rebajas = modelo `Discount` reutilizado; "oferta destacada" = nuevo flag `webstoreFeatured`. Descuentos ganan `version` para locking optimista (opcional, retrocompatible).

**Tech Stack:** Next.js 15 App Router, React 19, Prisma 7 + Neon, shadcn/ui, Tailwind 4, Zod. `pnpm`. **Sin framework de pruebas** en el repo → verificación por `pnpm prisma validate`, `pnpm db:generate`, `npx tsc --noEmit`, `pnpm lint`, `pnpm dev`.

**Spec:** `docs/superpowers/specs/2026-07-01-webstore-catalogo-management-design.md`

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `prisma/schema.prisma` | `Product.webstoreFeatured`, `Product.webstoreSortOrder`, `Discount.version` | Modify |
| `src/modules/inventory/actions/discount-actions.ts` | `version` opcional en `DiscountInput` + locking en `updateDiscount` | Modify |
| `src/modules/webstore/queries/catalog-queries.ts` | Lecturas del catálogo (lista, KPIs, descuentos por producto) | Create |
| `src/modules/webstore/actions/catalog-actions.ts` | Toggles de visibilidad/destacado + edición de precio (delega en `updateProduct`) | Create |
| `src/modules/webstore/lib/catalog-schemas.ts` | Schemas Zod de inputs | Create |
| `src/app/api/webstore/products/route.ts` | Exponer `compareAtPrice` + `featured`, ordenar destacados | Modify |
| `src/modules/webstore/components/webstore-catalog-client.tsx` | UI cliente del catálogo | Create |
| `src/app/(app)/(webstore)/webstore/catalogo/page.tsx` | Page server que hace fetch y renderiza el cliente | Create |
| `src/lib/module-registry.ts` | Ruta "Catálogo" en la entrada `webstore` | Modify |

**Reutilización (NO duplicar):** `updateProduct` y `getProductPriceHistoryAction` (`src/modules/inventory/actions/product-actions.ts`), `createDiscount`/`updateDiscount`/`toggleDiscount`/`deleteDiscount` (`discount-actions.ts`), `getEffectivePrice` (`src/modules/inventory/lib/effective-price.ts`), `formatAmount` (`src/modules/envios/lib/format.ts`), primitives de `@/components/ui/*`.

---

## Task 1: Schema — flags de escaparate + `version` en Discount

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Product` sección webstore ~línea 466; modelo `Discount` ~línea 1051)

- [ ] **Step 1: Añadir campos al modelo `Product`**

Junto a `webstoreEnabled` / `imageUrl`:

```prisma
  webstoreFeatured  Boolean  @default(false) @map("webstore_featured")
  webstoreSortOrder Int?     @map("webstore_sort_order")
```

Y añadir el índice al final del modelo (junto a los `@@index` existentes):

```prisma
  @@index([webstoreEnabled, webstoreFeatured, webstoreSortOrder])
```

- [ ] **Step 2: Añadir `version` al modelo `Discount`**

```prisma
  version    Int           @default(0)
```

- [ ] **Step 3: Validar el schema**

Run: `pnpm prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 4: Aplicar a la DB y regenerar cliente**

Run: `pnpm db:push && pnpm db:generate`
Expected: push aplica columnas nuevas sin pérdida de datos; cliente regenerado.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(webstore): flags de escaparate en Product y version en Discount"
```

---

## Task 2: Locking optimista opcional en `updateDiscount`

**Files:**
- Modify: `src/modules/inventory/actions/discount-actions.ts`

Objetivo: permitir edición concurrente segura sin romper la UI de descuentos de inventario existente (que NO pasa `version`).

- [ ] **Step 1: Añadir `version?: number` a `DiscountInput`**

Localizar la interfaz/`type` `DiscountInput` (usada por `createDiscount`/`updateDiscount`) y añadir:

```typescript
  version?: number;
```

- [ ] **Step 2: Aplicar locking en `updateDiscount` solo si llega `version`**

⚠️ **NO tocar** el `const prev = await tx.discount.findUnique(...)` (≈línea 87, ya existe) **ni** la llamada `createAuditLog(tx, { ..., oldValues: prev, newValues: data })` (≈líneas 103-111). Reutilizar ambos tal cual.

Sustituir **solo** la sentencia `await tx.discount.update({ where: { discountId: id }, data: {...} });` (≈líneas 88-101) por:

```typescript
    // Reusa el `prev` ya obtenido arriba — NO vuelvas a hacer findUnique.
    const discountData = {
      name: data.name,
      type: data.type,
      value: data.value,
      minQty: data.minQty ?? null,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      productId: data.productId ?? null,
      category: data.category ?? null,
      customerId: data.customerId ?? null,
      stackable: data.stackable ?? false,
      version: { increment: 1 },
    };

    if (data.version !== undefined) {
      const res = await tx.discount.updateMany({
        where: { discountId: id, version: data.version },
        data: discountData,
      });
      if (res.count === 0) throw new Error("STALE_VERSION");
    } else {
      await tx.discount.update({ where: { discountId: id }, data: discountData });
    }
    // El createAuditLog(tx, { ..., oldValues: prev, newValues: data }) existente queda intacto justo debajo.
```

- [ ] **Step 3: Traducir el error `STALE_VERSION` en el `catch`**

En el `catch` de `updateDiscount`, antes del mensaje genérico:

```typescript
    if (error instanceof Error && error.message === "STALE_VERSION") {
      return { success: false, error: "El descuento fue modificado por otra persona. Recarga e intenta de nuevo." };
    }
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos. La UI de inventario sigue compilando (no pasa `version` → rama `else`).

- [ ] **Step 5: Commit**

```bash
git add src/modules/inventory/actions/discount-actions.ts
git commit -m "feat(inventory): locking optimista opcional en updateDiscount"
```

---

## Task 3: Queries del catálogo de tienda

**Files:**
- Create: `src/modules/webstore/queries/catalog-queries.ts`

- [ ] **Step 1: Escribir el archivo completo**

```typescript
import { db } from "@/lib/db";
import { getEffectivePrice } from "@/modules/inventory/lib/effective-price";

export type CatalogStatus = "all" | "enabled" | "hidden";

export interface CatalogFilters {
  search?: string;
  category?: string;
  status?: CatalogStatus;
  onlyOnSale?: boolean;
  onlyFeatured?: boolean;
}

export interface CatalogRow {
  productId: number;
  name: string;
  sku: string;
  category: string | null;
  imageUrl: string | null;
  isActive: boolean;
  webstoreEnabled: boolean;
  webstoreFeatured: boolean;
  webstoreSortOrder: number | null;
  salePrice: string | null;
  basePrice: number;
  finalPrice: number;
  onSale: boolean;
  discountCount: number;
  stockAvailable: number;
}

export async function getWebstoreCatalog(filters: CatalogFilters = {}): Promise<CatalogRow[]> {
  const { search, category, status = "all", onlyOnSale, onlyFeatured } = filters;

  const products = await db.product.findMany({
    where: {
      isActive: true,
      ...(status === "enabled" && { webstoreEnabled: true }),
      ...(status === "hidden" && { webstoreEnabled: false }),
      ...(onlyFeatured && { webstoreFeatured: true }),
      ...(category && { category }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      stockLevels: { select: { currentQuantity: true } },
      _count: { select: { discounts: { where: { isActive: true } } } },
    },
    orderBy: [{ webstoreFeatured: "desc" }, { name: "asc" }],
  });

  const rows = await Promise.all(
    products.map(async (p) => {
      const price = await getEffectivePrice(db, { productId: p.productId, quantity: 1 });
      const stockAvailable = p.stockLevels.reduce((sum, s) => sum + Number(s.currentQuantity), 0);
      return {
        productId: p.productId,
        name: p.name,
        sku: p.sku,
        category: p.category,
        imageUrl: p.imageUrl,
        isActive: p.isActive,
        webstoreEnabled: p.webstoreEnabled,
        webstoreFeatured: p.webstoreFeatured,
        webstoreSortOrder: p.webstoreSortOrder,
        salePrice: p.salePrice != null ? p.salePrice.toString() : null,
        basePrice: price.basePrice,
        finalPrice: price.finalPrice,
        onSale: price.finalPrice < price.basePrice,
        discountCount: p._count.discounts,
        stockAvailable,
      };
    })
  );

  return onlyOnSale ? rows.filter((r) => r.onSale) : rows;
}

export interface CatalogKpis {
  enabled: number;
  onSale: number;
  featured: number;
}

export async function getWebstoreCatalogKpis(): Promise<CatalogKpis> {
  const rows = await getWebstoreCatalog({ status: "enabled" });
  return {
    enabled: rows.length,
    onSale: rows.filter((r) => r.onSale).length,
    featured: rows.filter((r) => r.webstoreFeatured).length,
  };
}

export interface ProductDiscountRow {
  discountId: number;
  name: string;
  type: string;
  value: string;
  minQty: string | null;
  startsAt: string | null;
  endsAt: string | null;
  stackable: boolean;
  isActive: boolean;
  version: number;
}

export async function getDiscountsByProduct(productId: number): Promise<ProductDiscountRow[]> {
  const rows = await db.discount.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((d) => ({
    discountId: d.discountId,
    name: d.name,
    type: d.type,
    value: d.value.toString(),
    minQty: d.minQty != null ? d.minQty.toString() : null,
    startsAt: d.startsAt ? d.startsAt.toISOString() : null,
    endsAt: d.endsAt ? d.endsAt.toISOString() : null,
    stackable: d.stackable,
    isActive: d.isActive,
    version: d.version,
  }));
}
```

> NOTA para el implementador: verificar que la relación de stock se llama `stockLevels` y que `Product` tiene relación `discounts` (confirmado en el schema). Si el nombre difiere, ajústalo leyendo `prisma/schema.prisma`.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/modules/webstore/queries/catalog-queries.ts
git commit -m "feat(webstore): queries del catálogo de tienda (lista, kpis, descuentos por producto)"
```

---

## Task 4: Schemas Zod + actions del catálogo

**Files:**
- Create: `src/modules/webstore/lib/catalog-schemas.ts`
- Create: `src/modules/webstore/actions/catalog-actions.ts`

- [ ] **Step 1: `catalog-schemas.ts`**

```typescript
import { z } from "zod";

export const updatePriceSchema = z.object({
  productId: z.number().int().positive(),
  salePrice: z.number().nonnegative(),
});

export const toggleFlagSchema = z.object({
  productId: z.number().int().positive(),
  value: z.boolean(),
});

export type UpdatePriceInput = z.infer<typeof updatePriceSchema>;
export type ToggleFlagInput = z.infer<typeof toggleFlagSchema>;
```

- [ ] **Step 2: `catalog-actions.ts`**

```typescript
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";
import type { ActionResult } from "@/types";
import { updateProduct } from "@/modules/inventory/actions/product-actions";
import { updatePriceSchema, toggleFlagSchema } from "../lib/catalog-schemas";

const CATALOG_PATH = "/webstore/catalogo";

export async function toggleWebstoreEnabled(
  productId: number,
  value: boolean
): Promise<ActionResult<void>> {
  const parsed = toggleFlagSchema.safeParse({ productId, value });
  if (!parsed.success) return { success: false, error: "Datos inválidos" };
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { productId },
        data: { webstoreEnabled: value },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Product",
        entityId: productId,
        module: "webstore",
        userId,
        newValues: { webstoreEnabled: value },
      });
    });
    revalidatePath(CATALOG_PATH);
    return { success: true, data: undefined };
  } catch (e) {
    console.error("toggleWebstoreEnabled:", e);
    return { success: false, error: "No se pudo actualizar la visibilidad del producto." };
  }
}

export async function toggleWebstoreFeatured(
  productId: number,
  value: boolean
): Promise<ActionResult<void>> {
  const parsed = toggleFlagSchema.safeParse({ productId, value });
  if (!parsed.success) return { success: false, error: "Datos inválidos" };
  try {
    const userId = await getCurrentUserId();
    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { productId },
        data: { webstoreFeatured: value },
      });
      await createAuditLog(tx, {
        action: "update",
        entityType: "Product",
        entityId: productId,
        module: "webstore",
        userId,
        newValues: { webstoreFeatured: value },
      });
    });
    revalidatePath(CATALOG_PATH);
    return { success: true, data: undefined };
  } catch (e) {
    console.error("toggleWebstoreFeatured:", e);
    return { success: false, error: "No se pudo actualizar la oferta destacada." };
  }
}

export async function updateWebstorePrice(
  productId: number,
  salePrice: number
): Promise<ActionResult<void>> {
  const parsed = updatePriceSchema.safeParse({ productId, salePrice });
  if (!parsed.success) return { success: false, error: "Precio inválido" };
  // Delega en updateProduct: escribe ProductPriceHistory automáticamente.
  const res = await updateProduct(productId, { salePrice });
  if (res.success) revalidatePath(CATALOG_PATH);
  return res;
}
```

> NOTA: confirmar la firma exacta de `createAuditLog` (`tx` como primer argumento) leyendo `src/lib/audit.ts`; el `CLAUDE.md` documenta esta forma. Ajustar si difiere.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/modules/webstore/lib/catalog-schemas.ts src/modules/webstore/actions/catalog-actions.ts
git commit -m "feat(webstore): actions de catálogo (visibilidad, destacado, precio con historial)"
```

---

## Task 5: Extender API pública del catálogo

**Files:**
- Modify: `src/app/api/webstore/products/route.ts`

- [ ] **Step 1: Incluir campos nuevos y ordenar destacados primero**

Cambiar el `findMany` para ordenar y (opcional) no hace falta select extra porque trae el modelo completo:

```typescript
  const products = await db.product.findMany({
    where: { webstoreEnabled: true, isActive: true },
    include: { stockLevels: { select: { currentQuantity: true } } },
    orderBy: [{ webstoreFeatured: "desc" }, { webstoreSortOrder: "asc" }, { name: "asc" }],
  });
```

- [ ] **Step 2: Extender el objeto de cada producto**

En el `map`, tras calcular `price` y `stockAvailable`:

```typescript
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
      };
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/webstore/products/route.ts
git commit -m "feat(webstore): exponer compareAtPrice y featured en el catálogo API"
```

---

## Task 6: UI — client component + page

**Files:**
- Create: `src/modules/webstore/components/webstore-catalog-client.tsx`
- Create: `src/app/(app)/(webstore)/webstore/catalogo/page.tsx`

**Patrón a espejar:** leer `src/modules/webstore/components/order-inbox-client.tsx` (estructura `"use client"`, `PageHeader`, grid de `KpiCard`, filtros) y `src/modules/inventory/components/product-list-client.tsx` para el uso exacto de `ResponsiveListView`/`DataTableColumn` y `MobileListCard`. Reusar esos patrones literalmente.

- [ ] **Step 1: `webstore-catalog-client.tsx`**

Requisitos de la UI (implementar espejando los patrones anteriores):
- `PageHeader` icon `Tags`, title "Catálogo de tienda", description corta, badge = nº productos.
- Grid `grid-cols-2 sm:grid-cols-4 gap-3` con `KpiCard` size `compact`: "En tienda" (`accent="brand"`), "Con oferta" (`accent="success"`), "Destacados" (`accent="warning"`).
- Toolbar: `Input` de búsqueda + `MobileFilterSheet` con `Select` de categoría, estado (todos/en tienda/oculto), y toggles "con oferta"/"destacado". Filtrado en cliente sobre las filas recibidas (o refetch por query params — cliente es suficiente para v1).
- `ResponsiveListView<CatalogRow>`:
  - Columnas desktop: Producto (imagen + nombre + SKU), Categoría, Precio (base tachado si `onSale` + final en `font-mono tabular-nums`), Stock, Estado (`StatusPill` `active`/`inactive` con label "En tienda"/"Oculto"), Acciones.
  - `mobileCard`: `MobileListCard` con title=nombre, subtitle=SKU, value=precio final, meta=estado/stock, actions=menú.
- Precio: usar `formatAmount` de `@/modules/envios/lib/format`. Rebaja: mostrar `basePrice` tachado (`line-through text-muted-foreground`) y `finalPrice` en color de éxito. Signo `−` ya lo maneja `formatAmount`.
- Por fila, acciones (usar `Switch` + un `DropdownMenu` o botones):
  - `Switch` "En tienda" → `toggleWebstoreEnabled(row.productId, next)`.
  - `Switch` "Destacado" → `toggleWebstoreFeatured(row.productId, next)`.
  - Botón "Editar precio" → `ResponsiveFormDialog` con `Input` numérico (default `row.salePrice`) → `updateWebstorePrice`.
  - Botón "Historial" → `ResponsiveFormDialog` que en `open` llama `getProductPriceHistoryAction(row.productId)` y pinta línea de tiempo `oldSalePrice → newSalePrice`, `changedByName`, `changedAt` (usar `toLocaleString("es-MX")`).
  - Botón "Descuentos" → `ResponsiveFormDialog` que lista `getDiscountsByProduct(row.productId)` con `StatusPill` activo/inactivo y permite crear (`createDiscount` con `productId` fijo) y activar/desactivar (`toggleDiscount`). Editar pasa `version` para locking.
- Manejo de resultados: todas las acciones devuelven `ActionResult`; en `!success` mostrar `toast.error(res.error)` (Sonner, ya en el proyecto), en éxito `toast.success(...)` y `router.refresh()`.
- `EmptyState` icon `PackageSearch` cuando no hay filas.
- Respetar `prefers-reduced-motion`, sin emojis, mobile-first (probar 375px).

Tipos de props del componente:

```typescript
type Props = {
  rows: CatalogRow[];
  kpis: CatalogKpis;
  categories: string[];
};
```

- [ ] **Step 2: `catalogo/page.tsx`**

```typescript
export const dynamic = "force-dynamic";

import { getWebstoreCatalog, getWebstoreCatalogKpis } from "@/modules/webstore/queries/catalog-queries";
import { WebstoreCatalogClient } from "@/modules/webstore/components/webstore-catalog-client";

export default async function WebstoreCatalogPage() {
  const [rows, kpis] = await Promise.all([getWebstoreCatalog(), getWebstoreCatalogKpis()]);
  const categories = Array.from(
    new Set(rows.map((r) => r.category).filter((c): c is string => Boolean(c)))
  ).sort();

  return (
    <div className="space-y-4">
      <WebstoreCatalogClient rows={rows} kpis={kpis} categories={categories} />
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/modules/webstore/components/webstore-catalog-client.tsx "src/app/(app)/(webstore)/webstore/catalogo/page.tsx"
git commit -m "feat(webstore): vista de catálogo de tienda (precio, ofertas, visibilidad, historial)"
```

---

## Task 7: Registrar la ruta en el sidebar

**Files:**
- Modify: `src/lib/module-registry.ts` (entrada `webstore`, ~líneas 164-173; imports de iconos ~líneas 1-36)

- [ ] **Step 1: Importar el icono `Tags`**

Añadir `Tags` a la lista de imports destructurados de `"lucide-react"`.

- [ ] **Step 2: Añadir la ruta**

En `routes` de la entrada `webstore`, como primer elemento (es la vista principal de gestión):

```typescript
    { name: "Catálogo", href: "/webstore/catalogo", icon: Tags },
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/module-registry.ts
git commit -m "feat(webstore): ruta Catálogo en el módulo tienda"
```

---

## Task 8: Verificación final (manual)

- [ ] **Step 1: Suite de verificación del repo**

Run: `pnpm prisma validate && pnpm db:generate && npx tsc --noEmit && pnpm lint`
Expected: todo verde.

- [ ] **Step 2: Prueba manual en dev**

Run: `pnpm dev` y abrir `/webstore/catalogo`.
Verificar (viewport 375px y desktop):
- Se listan productos; KPIs correctos.
- Toggle "En tienda" persiste y afecta a `GET /api/webstore/products`.
- Toggle "Destacado" persiste; destacados salen primero en el API.
- Editar precio → aparece en "Historial de precios" del producto.
- Crear/activar descuento → el precio final muestra rebaja (tachado + final).
- Filtros (categoría/estado/oferta/destacado/búsqueda) funcionan.

- [ ] **Step 3: Actualizar `CLAUDE.md` del proyecto**

Añadir la ruta `/webstore/catalogo` y los campos `webstoreFeatured`/`webstoreSortOrder`/`Discount.version` a las secciones correspondientes (según regla de mantenimiento de `CLAUDE.md`). Commit `chore(webstore): documentar catálogo en CLAUDE.md`.

---

## Riesgos / notas
- **`db push` no versiona**: los campos nuevos son columnas simples, sin CHECK/EXCLUDE → no requiere SQL crudo en `prisma/sql/`.
- **Serializar `Decimal`**: las queries ya convierten a `string`/`number` antes del cliente.
- **Cross-módulo**: webstore importa de inventory (`updateProduct`, `discount-actions`, `getEffectivePrice`) y de envios (`formatAmount`). Mantener contratos estables.
- **Sin tests**: el repo no tiene framework; la verificación es typecheck + lint + prueba manual. No introducir vitest/playwright en este alcance.
