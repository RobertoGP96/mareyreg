# Módulo Entregas · Estado vivo

Mensajería de efectivo: entregas a destinatarios, mensajeros y sus comisiones, y la galería de fotos de cada entrega. Nació dentro de `envios` (PR 8 de ese módulo) y se extrajo como módulo propio el 2026-09-19.

Plan de la extracción: `C:/Users/TrolPC/.claude/plans/entregas-modulo-mensajeria.md`

## Qué contiene

| Ruta | Qué hace |
|---|---|
| `/entregas` | Listado con KPIs (pendientes, entregadas, canceladas, comisión por pagar por moneda), filtros, vista rápida en sheet, alta/edición, marcar entregada con fotos, marcado masivo de comisiones. |
| `/entregas/[id]` | Página completa: destinatario (teléfono, dirección, mapa), montos con desglose de billetes, mensajero y comisión, cronología (quién registró, confirmó, pagó), referencia y notas, y galería editable. |
| `/entregas/destinatarios` | CRUD de quien recibe el efectivo (nombre, teléfono, dirección, URL de mapa). |
| `/entregas/mensajeros` | Perfil de mensajero sobre un `User`, comisión y moneda por defecto, comisión pendiente acumulada por moneda. |

Las URLs anteriores (`/envios/entregas`, `/envios/destinatarios`, `/envios/mensajeros`) redirigen a las nuevas.

## Decisiones clave

- **Modelos conservan su nombre** (`CashDelivery`, `CashDeliveryLine`, `CashDeliveryLineDenomination`, `Recipient`, `CourierProfile`): mover código no obliga a renombrar tablas. Viven en la sección `ENTREGAS MODULE` del schema.
- **Permiso propio `entregas`**. Admin pasa siempre; `prisma/seed-entregas.ts` se lo otorga a admins y a todo usuario que tuviera `envios`.
- **Dependencia con envios**: solo el catálogo `Currency` / `CurrencyDenomination` (leído por `queries/catalog-queries.ts`) y el componente `CurrencyChip`. Nada más cruza módulos.
- **Entrega multi-línea**: una `CashDelivery` tiene N `CashDeliveryLine` (una por moneda). El `amount` de cada línea es **derivado** de Σ(`unitValue` × `quantity`) del desglose y se recalcula siempre server-side en `resolveDeliveryLines`; el cliente nunca envía montos ni valores de billete. Moneda digital (USDT) captura monto directo, sin desglose.
- **Desglose obligatorio en la app, opcional en la DB**: Zod exige ≥1 billete por línea de efectivo; el trigger de cuadre hace `RETURN` si la línea no tiene desglose, para no romper las entregas migradas del modelo viejo.
- **Mensajero = `User` + `CourierProfile`**: quien tiene fila de perfil es mensajero. Comisión y moneda por defecto solo **pre-llenan** el formulario; el valor efectivo se guarda por entrega.
- **Comisión**: monto fijo por entrega con eje de estado propio (`pending | paid`). Cancelar una entrega revierte una comisión pagada. Revertir a mano es solo admin. Sin conversión FX: los totales se agrupan por moneda.
- **Galería (`CashDeliveryPhoto`)**: N fotos por entrega (máx. 10), cada una con tipo `receipt | id_document | other`, nota, orden y quién la subió. Se agregan al crear/editar, al **marcar entregada** (evidencia) y desde la página de detalle en cualquier estado salvo cancelada. Quitar una foto: quien la subió o un admin. `Cascade` desde la entrega: `deleteCashDelivery` audita el árbol completo antes de borrar.
- **`CashDelivery.photoUrl` está deprecado**: el código ya no lo escribe. `entregas-photos.sql` copia cada valor a una fila de la galería; mientras no se ejecute, el mapper lo muestra como foto "registro anterior" y al editar la entrega se convierte en fila. Borrar la columna es un paso posterior.
- **Binarios**: subida directa cliente → Vercel Blob vía `/api/deliveries/upload` (token firmado, JPG/PNG/WebP, 5 MB). El server solo recibe URLs. Al quitar fotos o eliminar la entrega se borra el blob **después** del commit, best-effort (`lib/blob.ts`).

## Aplicar a la DB

Mientras la tabla `cash_delivery_photos` no exista, `/entregas` falla con `P2021 The table public.cash_delivery_photos does not exist`.

Dos comandos desde la **raíz** del repo (PowerShell 5.1 no acepta `&&`; van por separado):

```bash
pnpm db:push
```

```bash
pnpm db:entregas
```

`pnpm db:entregas` aplica en orden, por WebSocket y sin `psql` ni `tsx`:

1. `entregas-photos-ddl.sql` — equivalente exacto de `db push` para la galería (por si `db push` falla con P1001 por el puerto 5432; si `db push` ya corrió, no hace nada).
2. `entregas-constraints.sql` — CHECKs, funciones y CONSTRAINT TRIGGERs de entregas (antes `envios-cash-delivery.sql`).
3. `entregas-photos.sql` — CHECKs de la galería + backfill de `photo_url` → `cash_delivery_photos`.
4. `entregas-permissions.sql` — permiso `entregas` a admins y a quien tenga `envios`.

Todos son idempotentes. Para un archivo suelto: `pnpm db:sql prisma/sql/<archivo>.sql` (ruta relativa a `apps/erp`). No usar `pnpm dlx tsx`: en pnpm 10 se queda esperando un prompt interactivo de aprobación de builds.

### Migración histórica a entregas multi-línea (ya aplicada)

Se hizo una sola vez con `envios-delivery-lines-pre.sql` → `db push` (o `envios-delivery-lines-ddl.sql`) → `envios-delivery-lines-post.sql`. Los archivos se conservan como registro; no volver a ejecutarlos.

## Invariantes en la DB (`entregas-constraints.sql`)

1. La denominación pertenece a la moneda de la línea y `unit_value` es el snapshot fiel del catálogo (trigger inmediato).
2. El desglose cuadra con el monto de la línea (CONSTRAINT TRIGGER diferido; cero filas = válido).
3. Toda entrega tiene al menos una línea (diferido).
4. Comisión con monto exige moneda y mensajero; `delivered_at` / `cancelled_at` / `commission_paid_at` acompañan a su estado.

Los triggers diferidos requieren transacciones interactivas reales: `db.ts` usa `PrismaNeon` (Pool/WebSocket). Si alguna vez se migra al adapter HTTP, el cuadre deja de aplicarse en la DB.

## Riesgos / pendientes

- **Entregas y comisiones siguen fuera del ledger de envios**: confirmar una entrega o pagar una comisión no crea `Operation` ni mueve `Account`. Decidirlo antes de que haya volumen.
- **Desglose todo-o-nada**: no hay "1 × 1000 CUP y el resto sin especificar".
- **Borrar `cash_deliveries.photo_url`** cuando el backfill esté verificado (`SELECT count(*) FROM cash_deliveries WHERE photo_url IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cash_delivery_photos p WHERE p.delivery_id = cash_deliveries.delivery_id)` debe dar 0).
- **Historial por destinatario** (`/entregas/destinatarios/[id]` con sus entregas) es el siguiente paso natural.

## Archivos clave

- Schema: [apps/erp/prisma/schema.prisma](../apps/erp/prisma/schema.prisma) (sección `ENTREGAS MODULE`).
- SQL: [entregas-photos-ddl.sql](../apps/erp/prisma/sql/entregas-photos-ddl.sql) (equivale a `db push`), [entregas-constraints.sql](../apps/erp/prisma/sql/entregas-constraints.sql), [entregas-photos.sql](../apps/erp/prisma/sql/entregas-photos.sql), [entregas-permissions.sql](../apps/erp/prisma/sql/entregas-permissions.sql). Se aplican juntos con `pnpm db:entregas`.
- Módulo: `apps/erp/src/modules/entregas/`
  - `lib/schemas.ts` — Zod (entrega, líneas, fotos, destinatario, mensajero).
  - `lib/delivery-lines.ts` — `resolveDeliveryLines` (+ tests).
  - `lib/delivery-photos.ts` — `appendPhotos` / `syncPhotos`.
  - `actions/cash-delivery-actions.ts`, `actions/delivery-photo-actions.ts`, `actions/recipient-actions.ts`, `actions/courier-actions.ts`.
  - `components/deliveries/delivery-detail-view.tsx` — vista compartida por el sheet y la página.
- Rutas: `apps/erp/src/app/(app)/(entregas)/`.
- Upload: [src/app/api/deliveries/upload/route.ts](../apps/erp/src/app/api/deliveries/upload/route.ts).

## Comandos útiles

```bash
# Audit log del módulo
psql "$DATABASE_URL" -c "SELECT created_at, action, entity_type, entity_id FROM audit_log WHERE module='entregas' ORDER BY created_at DESC LIMIT 20;"

# Tests del helper de líneas
pnpm --filter erp test -- delivery-lines
```
