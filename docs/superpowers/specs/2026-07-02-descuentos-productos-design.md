# Control de descuentos de producto — Diseño (Enfoque A)

Fecha: 2026-07-02 · Módulo: `inventory` (con superficies en `webstore` e inventario) · Estado: aprobado (Enfoque A)

## Problema y objetivos

El usuario (admin) reportó cinco cosas:

1. **Bug**: "no puedo editar los descuentos siendo admin" → error *"Debes iniciar sesión para realizar esta acción"*.
2. Poder **controlar** los descuentos de los productos.
3. **Soporte de varios descuentos** definidos por producto.
4. **Historial de descuentos** para mayor control.
5. **Solo un descuento aplicado a la vez**.
6. (UI) Arreglar el **toggle** para que sea **2D** (plano).

Decisiones tomadas con el usuario:
- Ubicación de gestión: **en todas las superficies** (ficha de producto en inventario, Tienda en línea y página dedicada de Descuentos).
- Regla: un producto puede **tener varios** descuentos definidos + historial, pero **solo uno activo a la vez**; activar uno desactiva los demás. **Se elimina** el concepto `stackable` (acumulable).
- Historial: **ciclo de vida completo** (creación, edición con valores antes/después, activación, desactivación, borrado) con usuario y fecha, visible en la ficha del producto.

## Bug de autenticación (RESUELTO)

Causa raíz: el callback `session` (`src/lib/auth.config.ts`) puebla `session.user.userId`, pero `getCurrentUserId` (`src/lib/audit.ts`) leía `session.user.id` (inexistente) → devolvía `null` → `requireCurrentUserId()` lanzaba `Error("No autenticado")`. Por eso la navegación funcionaba (guards leen `session.user.role`) pero toda mutación con `requireCurrentUserId()` fallaba.

Fix aplicado (verificado con `tsc --noEmit` limpio):
- `src/lib/audit.ts` → `getCurrentUserId` lee `session.user.userId ?? session.user.id`.
- `src/app/api/products/upload/route.ts` → mismo patrón (bug latente idéntico, `userId` quedaba `null`).

No es parte del rediseño; se documenta por trazabilidad.

## Enfoque elegido: A

Reusar el modelo `Discount` existente + **índice parcial único** (garantía dura a nivel BD) + tabla dedicada `DiscountHistory`. Descartados: B (FK `activeDiscountId` en `Product` → duplica fuente de verdad) y C (historial vía `AuditLog` genérico → difícil de presentar por producto).

## Modelo de datos (`prisma/schema.prisma`)

**`Discount`**: eliminar el campo `stackable`. Añadir back-relation `history DiscountHistory[]`.

**Nuevo enum + modelo** (respetar convenciones: PK semántica con `@map`, `camelCase`↔`snake_case`, `@@map` plural):

```prisma
enum DiscountHistoryAction {
  created
  updated
  activated
  deactivated
  deleted
}

model DiscountHistory {
  historyId  Int                   @id @default(autoincrement()) @map("history_id")
  discountId Int?                  @map("discount_id")
  productId  Int?                  @map("product_id")
  action     DiscountHistoryAction
  oldValues  Json?                 @map("old_values")
  newValues  Json?                 @map("new_values")
  changedBy  Int?                  @map("changed_by")
  changedAt  DateTime              @default(now()) @map("changed_at")

  discount      Discount? @relation(fields: [discountId], references: [discountId], onDelete: SetNull)
  product       Product?  @relation(fields: [productId], references: [productId], onDelete: SetNull)
  changedByUser User?     @relation(fields: [changedBy], references: [userId], onDelete: SetNull)

  @@index([productId, changedAt])
  @@map("discount_history")
}
```

Back-relations a añadir: `Product.discountHistory DiscountHistory[]`, `User.discountHistory DiscountHistory[]`, `Discount.history DiscountHistory[]`.

`onDelete: SetNull` en las tres FK: preservar la fila de historial aunque se borre el descuento/producto/usuario (dato auditable — nunca `Cascade`).

**SQL crudo** (`prisma/sql/inventory-discounts.sql`) — `db push` NO aplica índices parciales; ejecutar manualmente con `psql`. Verificar el nombre real de la tabla (`@@map` de `Discount`):

```sql
-- Regla de negocio: máximo un descuento activo por producto.
CREATE UNIQUE INDEX IF NOT EXISTS discount_one_active_per_product
  ON discounts (product_id)
  WHERE is_active = true AND product_id IS NOT NULL;
```

## Regla "1 activo a la vez"

`activateDiscount(id)` dentro de una `$transaction`:
1. Leer el descuento y su `productId`.
2. Si `productId != null`: `updateMany` sobre los demás activos del mismo producto (`isActive: false`), recolectando sus ids para el historial.
3. Activar el objetivo (`isActive: true`).
4. Escribir `DiscountHistory` (`activated` para el objetivo; `deactivated` para cada hermano desactivado).
5. Audit log dentro de la tx (convención del repo).

El índice parcial es la red de seguridad ante condiciones de carrera. Optimistic locking (`version`) se mantiene en `update`.

## Precio efectivo (`src/modules/inventory/lib/effective-price.ts`)

Simplificar: eliminar la lógica `stackable`/suma. De los descuentos **activos y vigentes** aplicables (respetando `startsAt/endsAt/minQty`), aplicar **uno solo** — el de mayor beneficio para el cliente. `appliedDiscounts` contiene como máximo un elemento. Esto honra "solo un descuento a la vez" incluso si coexisten descuentos de producto/categoría/cliente.

## Server actions y queries (`src/modules/inventory/…`)

- `discount-actions.ts`: quitar `stackable` de `DiscountInput` y de create/update; añadir `activateDiscount`/ajustar `toggleDiscount` con la regla de arriba; escribir `DiscountHistory` en cada mutación; **corregir `revalidatePath`** para cubrir rutas reales (webstore, inventario/productos y la página de descuentos), no solo `/discounts`.
- Nueva query `getDiscountHistory(productId)` (server-only) y su action wrapper para el diálogo.
- `webstore/queries/catalog-queries.ts`: quitar `stackable` de `ProductDiscountRow`.

## UI (mobile-first, reusando primitives)

- **Componente compartido** de gestión de descuentos por producto (evolución de `ProductDiscountsDialog`): lista de descuentos con indicador de cuál está activo, form crear/editar (sin campo `stackable`), acción **Activar** (radio-like: activar uno desactiva el resto en la UI), y sección **Historial** (lee `getDiscountHistory`). Montos en `font-mono tabular-nums`; signos `−`/`+`.
- **Superficies**: inventario (acción "Descuentos" por producto en `product-list-client.tsx`), Tienda en línea (ya montado), y página dedicada de Descuentos (integrar con el `discount-list-client`/ruta `/discounts` existente; verificar y no duplicar).

## Toggle 2D (`src/components/ui/switch.tsx`)

Aplanar el único `Switch` del proyecto (se usa en 18 sitios):
- Quitar `shadow-sm` del root y `shadow-md` del thumb.
- Reemplazar el gradiente del estado activo (`linear-gradient(135deg,#1e3a8a,#2563eb,#60a5fa)`) por **color sólido** de marca (token existente, p.ej. `bg-primary`/var de marca).
- Conservar el `focus-visible:ring` (accesibilidad). Respetar `prefers-reduced-motion` (ya lo hace vía `transition-*`).

## Testing

- Unit `effective-price`: 1 activo gana; vigencias (`startsAt/endsAt`); `minQty`; sin descuentos → precio base.
- Integración actions (Prisma mockeado): activar desactiva a los hermanos; se escribe `DiscountHistory`; audit dentro de la tx; `update` respeta `version`.
- Regla del índice parcial (nivel BD) documentada; smoke manual en `pnpm dev`.

## Alcance / NO alcance

- **Sí**: producto (`Discount.productId`). Regla "1 activo", historial, UI en 3 superficies, toggle 2D, fix de revalidación.
- **No**: cambiar la semántica de descuentos de **categoría/cliente** (se mantienen; `effective-price` solo garantiza que se aplique uno). Sin migraciones manuales en `prisma/migrations/` (se usa `db push` + SQL crudo). No tocar otros módulos.

## Plan de implementación (slices verticales)

1. **Schema & DB**: schema.prisma (quitar `stackable`, añadir `DiscountHistory`), `prisma/sql/inventory-discounts.sql`, `prisma validate` + `generate`. `db push` + `psql` los ejecuta/confirma el usuario (mutación de BD real).
2. **Backend**: actions (activate + history + revalidación), `effective-price`, queries. `tsc` limpio.
3. **UI**: componente compartido + 3 superficies + sección historial. Toggle 2D.
4. **Verificación**: tests + `code-reviewer` + `pnpm dev` smoke.

Commits `feat(inventory):` / `fix(...)`, cuerpo en español, sin push salvo que el usuario lo pida.
