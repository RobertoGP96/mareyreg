# Mareyway · Guía para agentes IA

Este archivo lo lee Claude Code automáticamente al iniciar sesión en el repo. Mantenerlo corto, opinado y orientado a "qué hacer / qué no hacer". Para guías más largas usar `docs/`.

> Para profundizar: [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md), [docs/MODULE_TEMPLATE.md](docs/MODULE_TEMPLATE.md), [docs/ENVIOS.md](docs/ENVIOS.md).

## Stack

- **Next.js 15.3** App Router · **React 19** · **TypeScript estricto**
- **Prisma 7** + **Neon** serverless adapter (`@prisma/adapter-neon`)
- **shadcn/ui** sobre **Radix** + **Tailwind 4**
- **react-hook-form** + **Zod** + **Sileo** (toasts, vía adaptador `@/lib/toast`) + **Recharts**
- **next-auth 5 beta** (sesiones)
- Idioma de la UI: **español** (México). Identificadores y nombres de archivo en inglés.



## Estructura (monorepo pnpm workspaces + Turborepo)

```

pnpm-workspace.yaml / turbo.json  # workspace: apps/*
package.json                      # raíz: solo turbo + scripts proxy (dev:erp, dev:tienda, db:*)
apps/
  erp/                            # el ERP Mareyway (toda la app original vive aquí)
    prisma/
      schema.prisma               # único archivo de modelos (1.5k+ líneas, secciones por módulo)
      sql/<modulo>-*.sql          # SQL crudo para CHECK / EXCLUDE / matviews (db push no los maneja)
      seed-<modulo>.ts            # seeds opcionales por módulo
    src/
      app/(app)/(<modulo>)/       # rutas autenticadas agrupadas por módulo
        layout.tsx                # SIEMPRE: await requireModule("<id>")
        <ruta>/page.tsx
      modules/<modulo>/
        actions/*.ts              # "use server" — mutaciones
        queries/*.ts              # lecturas (server-only, NO "use server")
        components/*.tsx          # cliente; sub-carpetas por entidad si crece
        lib/*.ts                  # utilidades del módulo (schemas Zod, format, helpers de tx)
      components/ui/              # shadcn + primitives compartidos (NO modificar sin razón)
      lib/                        # helpers globales (db, auth, audit, module-registry)
      types/index.ts              # ActionResult<T>, re-exports de Prisma
    generated/prisma/             # cliente generado — NO editar, NO commitear (gitignored)
    .env / .env.local             # secretos del ERP (viven aquí, NO en la raíz)
  tienda/                         # storefront público (puerto 3001) — diseño "Tienda Completa v2" (azul/gris, Space Grotesk, lucide-react), mobile 430px + desktop responsive (TopNav md+, BottomNav móvil)
    src/components/ui/            # primitives shadcn-style propias de la tienda (input, select, slider, button, badge) tematizadas con sus tokens; cn() en src/lib/utils.ts — NO importar los ui/ del ERP
    src/lib/erp-client.ts         # cliente tipado hacia la API webstore del ERP
    src/lib/store.tsx             # estado cliente (carrito/favoritos/perfil/pedidos) persistido en localStorage
    src/lib/cart-totals.ts        # reglas: envío gratis ≥$100, envío $5 domicilio, cupón AZUL10 −10%
    src/app/actions/order-actions.ts  # server action → POST /api/webstore/orders (Zod, externalOrderId idempotente)
    src/app/                      # rutas: / catalogo(?ofertas=1|?destacados=1|?cat=|?q=) producto/[sku] favoritos carrito checkout pedido-confirmado perfil(/pedidos,/datos) login registro
    .env.example                  # WEBSTORE_API_URL + WEBSTORE_API_KEY (generar key en ERP /webstore/api-keys o `pnpm dlx tsx scripts/create-webstore-key.ts` desde apps/erp; scopes read_catalog+create_orders+manage_customers)
docs/                             # documentación cross-app (WEBSTORE.md = contrato entre apps)
```

Reglas del monorepo:
- La tienda consume datos **solo vía HTTP** (`GET /api/webstore/products`, `POST /api/webstore/orders` con Bearer API key). **NO** importa Prisma, `@/lib/db` ni código del ERP.
- Comandos por app: `pnpm --filter erp <script>` / `pnpm --filter tienda <script>`. Los comandos de DB (`db:push`, `db:generate`, `db:studio`) tienen proxy en la raíz y fijan el cwd en `apps/erp` (dotenv de `prisma.config.ts` carga el `.env` del cwd).
- Dev: `pnpm dev:erp` (puerto 3000) y `pnpm dev:tienda` (puerto 3001).
- Deploy: 2 proyectos Vercel sobre el mismo repo — Root Directory `apps/erp` y `apps/tienda`.

Patrón a imitar: **`src/modules/pacas/`** (módulo más maduro). Todo módulo nuevo debe seguir su forma.

## Convenciones de Prisma

- PK semántica + `@map("id")`: `userId Int @id @default(autoincrement()) @map("user_id")`. El plural en inglés con `@@map("snake_case")`.
- Columnas: `camelCase` en TS, `snake_case` en DB via `@map`.
- Cascadas: para datos financieros / ledgers usa `Restrict`. `Cascade` solo cuando el hijo no tenga sentido sin el padre y no haya registro de auditoría que preservar.
- Decimal: `@db.Decimal(20, 8)` para montos monetarios. Convertir a `string`/`number` antes de pasar al cliente.
- Concurrencia (Neon serverless **no soporta `SELECT FOR UPDATE` confiable**): usar **optimistic locking con campo `version Int`** + `UPDATE ... WHERE id=$1 AND version=$2 RETURNING ...`. Reintento corto (3 intentos) ante stale.
- `db push` no aplica CHECK ni EXCLUDE ni materialized views. Esos van en `prisma/sql/<modulo>-*.sql` y se aplican manualmente con `psql`.

## Server actions (patrón obligatorio)

```ts
"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";
import type { ActionResult } from "@/types";

export async function createX(input: XInput): Promise<ActionResult<{ id: number }>> {
  try {
    // 1. Validar (Zod si el input viene de form)
    const userId = await getCurrentUserId();
    const result = await db.$transaction(async (tx) => {
      // 2. Operación principal
      const row = await tx.x.create({ data: ... });
      // 3. Audit dentro de la tx
      await createAuditLog(tx, { action: "create", entityType: "X", entityId: row.id, module: "<modulo>", userId, newValues: input });
      return row;
    });
    revalidatePath("/<modulo>/<ruta>");
    return { success: true, data: { id: result.id } };
  } catch (e) {
    console.error("createX:", e);
    return { success: false, error: "Mensaje en español para el usuario" };
  }
}
```

Reglas:
- **Toda mutación** retorna `ActionResult<T>` (definido en `src/types/index.ts`).
- **Toda mutación** crea audit log dentro de la transacción.
- **Toda mutación** llama a `revalidatePath` en las rutas afectadas.
- Mensajes de error al usuario en **español**, sin tecnicismos. Loguear el error real con `console.error`.
- No exponer `Error.message` directo al cliente.
- Acciones que tocan dinero, balances o ledger **siempre** usan `db.$transaction` y la audit es obligatoria.
- Archivos `"use server"` solo pueden exportar **funciones async** — un `export const`/objeto rompe el registro de actions de la página en runtime (el POST falla con "A 'use server' file can only export async functions") y la UI se queda colgada. Constantes compartidas van en `lib/` del módulo.
- Handlers de cliente que llaman server actions: `try/catch/finally` con el `setIsSubmitting(false)` en el `finally` — si la action rechaza (500, red), el spinner no debe quedarse atascado.

## Auth y permisos

- Layouts de módulo: `await requireModule("<id>")` desde `src/lib/auth-guard.ts`.
- IDs y rutas se declaran en `src/lib/module-registry.ts` (sidebar lo lee).
- Usuario actual: `getCurrentUserId()` (devuelve `number | null`) o `requireCurrentUserId()` (lanza si no hay sesión).
- Roles: `admin`, `dispatcher`, `viewer`. Admin pasa todos los `requireModule`.
- **Server actions que mutan** exigen `requireCurrentUserId()` (lanza "No autenticado"); operaciones sensibles añaden `await assertRole("admin", ...)` (`src/lib/auth-guard.ts`, lanza `ForbiddenError` — no usar `requireRole`, que hace redirect y es solo para layouts).
- Stock/inventario: nunca `decrement` ciego — `updateMany` condicional (`{ gte: qty }`) + verificar `count`, o el helper compartido `dispatchLines`/`reverseInvoiceStock` de `src/modules/sales/lib/dispatch-lines.ts` (lo usan POS y webstore).
- **Inventario multi-unidad**: stock, kardex (`StockMovement`) y valuación van SIEMPRE en **unidad base**. Las líneas de venta/compra guardan `quantity` en la unidad vendida/comprada + snapshot `unitFactor`/`baseQuantity`. El factor se resuelve SIEMPRE server-side desde `ProductPresentation` (nunca del cliente); conversión única en `src/modules/inventory/lib/units.ts` (`toBaseQuantity`). Precios menudeo/mayoreo por presentación vía `getEffectiveLinePrices` (`effective-price.ts`); `Product.secondaryPrice` está DEPRECADO. Cambios de precio escriben `PresentationPriceHistory`/`ProductPriceHistory`; ajuste masivo solo admin (`pricing-actions.ts`). `Warehouse.locationType` (`general|store|service_unit`) es el tipo operativo — el POS despacha del `store`; `warehouseType` es el tipo físico. Tras `db push` aplicar `prisma/sql/inventory-presentations.sql`, `inventory-locations.sql` y `purchasing-presentations.sql`.
- **Multi-moneda**: moneda base **CUP, 0 decimales**, vía `Company.baseCurrencyId`. Tasa global única por par en `ExchangeRate` (`/currency/tasas` — NO confundir con `ExchangeRateRule` de envios). Convención: `exchangeRate` = CUP por 1 unidad de moneda original; el snapshot se toma dentro de la misma tx que la operación. Helper único `src/lib/currency.ts` (`getBaseCurrency`/`getRateToBase`/`convertToBase`/`roundToCurrency`) — nunca reimplementar la conversión. Valuación y kardex (`ProductValuation`, `InventoryLayer`, `StockMovement`) van SIEMPRE en CUP, con el trío `origCurrencyId`/`origUnitCost`/`exchangeRate` como referencia de la moneda original (null = el movimiento ya estaba en CUP). `ProductCost` es el costo de **reposición**, alimentado por recepciones de compra (`Product.costPrice` es un espejo de solo lectura, no editable). Los precios de venta (`Product.salePrice`, `ProductPresentation.retailPrice`/`wholesalePrice`) se definen en cualquier moneda vía `*CurrencyId`; `effective-price.ts` convierte y redondea a CUP. Pagos multi-moneda en `InvoicePayment`/`SupplierPayment`: `amount` siempre en la moneda contable, `amountTendered` es lo entregado por el cliente. Reporte de márgenes: `/margins` (`margin-report-queries.ts`) compara precio efectivo vs. costo contable vs. costo de reposición. Tras `db push` aplicar `prisma/sql/currency-constraints.sql` y `currency-backfill.sql`.
- **Peso variable (catch weight)**: productos con `Product.isCatchWeight` (quesos, etc.) tienen unidad base **kg** y contador dual `StockLevel.currentPieces`; sus presentaciones Pieza/Caja llevan `piecesPerUnit` y `factor` = peso NOMINAL (solo estimación). Discriminador de línea: `pieces IS NOT NULL` ⇒ `baseQuantity` = peso REAL capturado (`actualWeightKg` en `dispatchLines`/`createInvoice`; `pieceWeights[]` en recepción) y `unitPrice` es POR KG (`pricePerBase` de `getEffectiveLinePrices`). Decrementos SIEMPRE duales y atómicos (un solo `updateMany` con `gte` en kg y piezas); `allowNegative` prohibido; merma solo-kg = `adjustment` con `pieces = 0`. Pedidos webstore con estas líneas quedan `awaiting_weighing` (sin factura ni stock) hasta `fulfillWebstoreOrder` con pesos reales — salvo que el cliente haya elegido piezas registradas (ver abajo). Helpers en `units.ts` (`piecesFor`, `catchWeightBaseQuantity`, `formatCatchWeight`, `formatWeightPrice`). Tras `db push` aplicar `prisma/sql/inventory-catch-weight.sql`.
- **Registro de pesajes (`ProductPiece`)**: cada pieza física pesada es un registro con identidad — `weightKg` real, `pieceCount` (1 = pieza suelta, `piecesPerUnit` = caja pesada completa), almacén y estado `available|reserved|sold|disposed`. Se crean en recepción (un registro por peso; `ReceiptLineInput.weighingMode` `"piece"`/`"unit"`) o por alta manual en `/stock/pesajes` (`registerInitialPieces` valida cuadre SIN tocar `StockLevel`). **`StockLevel` sigue siendo la fuente de los agregados**: toda operación por pieza muta pieza + agregado en la MISMA tx; invariante `Σ piezas available ≤ StockLevel` (el remanente sin registrar se vende con peso manual — modo mixto permanente). Venta: `DispatchLineInput.pieceIds` deriva peso/piezas server-side y reclama por pieza con `updateMany` condicionado a estado Y `weightKg` leído (un re-pesaje concurrente aborta la venta); el POS lista piezas con `getAvailablePiecesAction` y el carrito/ticket muestran solo kg (`formatWeightPrice`). Operaciones por pieza en `src/modules/inventory/actions/piece-actions.ts` (transferir/baja/re-pesaje con `version`); la merma de peso de una pieza registrada va por `reweighPiece`, NO por ajuste global solo-kg (rompería el cuadre). Cancelaciones (factura/pedido web) liberan piezas en la misma tx del reingreso. Webstore: catálogo expone `pieces` con precio de `piecePrice()` (única fórmula de redondeo, `src/modules/webstore/lib/piece-price.ts`); pedidos con `pieceIds` reservan atómicamente y facturan de inmediato; conflicto ⇒ `409 pieces_unavailable` (contrato en `docs/WEBSTORE.md`). Tras `db push` aplicar `prisma/sql/inventory-pieces.sql` (con `node scripts/apply-sql.mjs` si no hay psql).
- **Webstore ofertas/clientes**: una oferta (`WebstoreOffer`) materializa filas `Discount` (una por producto, ligadas por `offerId`) vía `src/modules/webstore/lib/sync-offer-discounts.ts` — no editar esos discounts desde inventario ni tocar `effective-price.ts` (el pricing las aplica sin cambios; sigue rigiendo "1 descuento activo por producto"). Clientes de la tienda: `Customer.source = 'webstore'` con matching por `normalizedPhone` (índice único parcial); el registro/perfil de la tienda sincroniza vía `POST /api/webstore/customers` (scope `manage_customers`, best-effort — nunca romper el flujo local si el ERP no responde). Tras `db push` aplicar `prisma/sql/webstore-offers.sql` y `webstore-customers.sql`.
- **Webstore almacén**: el almacén cuyo stock expone y despacha la tienda se configura en `/webstore/configuracion` (`Company.webstoreWarehouseId`, admin-only). `getDefaultWebstoreWarehouseId` (`src/modules/webstore/lib/dispatch-warehouse.ts`) es el único punto de verdad — catálogo y despacho DEBEN usarlo; prioridad: configurado → primer almacén activo por id. Un `warehouseId` explícito en el payload de la orden sigue teniendo prioridad.

## UI (mobile-first, premium)

Primitives en `src/components/ui/` (NO inventar variantes; reusar):

- `PageHeader`: header con icon, title, description, badge, slot de acciones. Va siempre al inicio de cada page.
- `ResponsiveFormDialog`: sheet bottom en `<md`, dialog en `>=md`. Para todo formulario.
- `MobileListCard` + `<Table>`: lista con dos vistas (cards en mobile, tabla en desktop). Existe `ResponsiveListView` que las une.
- `MobileFilterSheet`: filtros en mobile.
- `KpiCard` / `MetricTile` / `Spark`: dashboard.
- `StatusPill`: badges de estado (pending/confirmed/cancelled, active/inactive).
- `Fab`: floating action button (mobile primary).
- `EmptyState`: vacíos con icono + frase + CTA.

Reglas:
- **Mobile-first** absoluto. Probar viewport 375px antes de claim "listo".
- Montos monetarios: `font-mono tabular-nums` siempre.
- Signo `−` (U+2212) para negativos, `+` (U+002B) para positivos, coloreados.
- `prefers-reduced-motion`: respetar siempre. Animaciones opcionales detrás de check.
- No emojis en UI ni en código a menos que el usuario lo pida.
- No agregar comentarios "lo que hace el código". Solo el "por qué" cuando sea no-obvio.

## Skills y agentes

Resumen ejecutivo (detalle en [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md)):

- **Explorar el repo (>3 búsquedas)** → `Agent` con `subagent_type: Explore`, en paralelo si las áreas son independientes.
- **Diseñar feature complejo** → `Agent` con `subagent_type: Plan`. Escribir plan a archivo de plan, iterar con `AskUserQuestion`, cerrar con `ExitPlanMode`.
- **Schema / DB / migraciones** → `database-architect` para revisar concurrencia, índices, cascadas. Aplicar SQL crudo en `prisma/sql/`.
- **UI/UX premium / dashboards / formularios** → `ui-ux-designer` agent + skill `vercel:react-best-practices` o `senior-frontend`.
- **Seguridad / auth / endpoints sensibles** → `security-reviewer` después de escribir.
- **Refactor / limpieza** → `refactor-cleaner` o skill `simplify` sobre código tocado en la sesión.
- **Excel real del cliente** → skill `xlsx` (openpyxl). El usuario suele compartir hojas con miles de filas; leer en streaming (`read_only=True`).

Skills útiles ya disponibles: `clean-code`, `senior-frontend`, `senior-fullstack`, `senior-backend`, `senior-architect`, `vercel:nextjs`, `vercel:react-best-practices`, `supabase-postgres-best-practices`, `xlsx`, `pdf-anthropic`, `webapp-testing`.

## Workflow estándar

1. **Entender** — explorar (Explore agent o Grep/Glob), leer ficheros clave, no asumir.
2. **Planear** — para tareas no triviales, escribir un plan en `C:/Users/PC/.claude/plans/<slug>.md` y validar con el usuario (`AskUserQuestion` para ambigüedades) antes de tocar código.
3. **Ejecutar** — implementar PR pequeños y verticales. Cada PR: schema/migración/registry → backend → UI → polish, según el módulo.
4. **Verificar** — `pnpm --filter erp exec prisma validate`, `pnpm db:generate`, `pnpm --filter erp exec tsc --noEmit`, `pnpm test` (turbo → vitest), idealmente `pnpm dev:erp` (o `dev:tienda`) y probar la ruta tocada.
5. **Commitear** — `feat(<modulo>):`, `fix(<modulo>):`, `chore(<modulo>):`. Cuerpo en español, conciso, agrupando cambios por archivo o área. Co-Authored-By incluido.
6. **Pushear** sólo cuando el usuario lo pida, o explícitamente lo confirme.

## Lo que NO hacer

- ❌ No editar `generated/prisma/`, `node_modules/`, `.next/`.
- ❌ No agregar `currency: string` ad-hoc; el modelo `Currency` ya existe (módulo envios).
- ❌ No usar `SELECT FOR UPDATE` con Neon HTTP adapter — corrupción silenciosa.
- ❌ No `Cascade` cuando hay datos financieros o auditables.
- ❌ No exponer `Decimal` de Prisma directo al cliente — siempre serializar (`.toString()` / `.toNumber()` con cuidado).
- ❌ No crear migraciones manuales en `prisma/migrations/` (el proyecto usa `db push`).
- ❌ No `git push --force` ni `--no-verify` salvo que el usuario lo pida explícitamente.
- ❌ No ampliar el alcance de un PR. Un fix es un fix; refactorizar lo de al lado va aparte.
- ❌ No agregar comentarios narrando lo que el código hace.

## Secretos y entorno

- `.env`, `.env.local`: nunca commitear. Si están listados en `.gitignore`, asumir secretos vivos dentro.
- Todas las variables sensibles ya están en Neon Postgres / Vercel. No re-leer `.env` salvo que sea estrictamente necesario.
