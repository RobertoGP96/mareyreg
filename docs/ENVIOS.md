# Módulo Envíos · Estado vivo

Módulo de envío de efectivo. Reemplaza el flujo en Excel `Operaciones Marey 2025 septiembre.xlsx` (32 hojas, una por grupo/persona).

Plan completo de diseño: `C:/Users/PC/.claude/plans/c-users-pc-onedrive-gerel-marey-operaci-toasty-pnueli.md`

## Estado

| PR | Contenido | Estado | Commit |
|---|---|---|---|
| 1 | Schema + SQL + seed + registry + layout | ✅ | `8008503` |
| 2 | CRUD Monedas + Grupos | ⏳ | — |
| 3 | Cuentas + Tasas de cambio | ⏳ | — |
| 4 | Operaciones (depósito/retiro/ajuste) con form único | ⏳ | — |
| 5 | Transferencias + Pendientes + bulk-confirm | ⏳ | — |
| 6 | Dashboard premium (KPIs, Cmd+K, audit tooltip, polish) | ⏳ | — |
| 7 | Hardening (tests de concurrencia, e2e) | ⏳ | — |

## Decisiones clave

- **AccountGroup**: cada hoja del Excel = un grupo, con N `Account` (una por moneda). Constraint `@@unique([groupId, currencyId])`.
- **Concurrency**: optimistic locking con `Account.version`. Neon serverless HTTP **no** soporta `SELECT FOR UPDATE` confiable.
- **OperationStatus**: `pending | confirmed | cancelled`. Solo `confirmed` mueve balance. Pendientes se confirman individualmente o en bulk.
- **Transferencia inter-moneda**: dos `Operation` (`transfer_out`, `transfer_in`) con `reference` compartido, conversión por `ExchangeRateRule` con rangos.
- **Tasa direccional**: `Account.exchangeRateRuleId` aplica a transferencias **outgoing** desde esa cuenta.

## Aplicar el módulo a la DB

```bash
# 1. Schema base (modelos, enums, índices)
pnpm db:push

# 2. Constraints CHECK / EXCLUDE + materialized views
psql "$DATABASE_URL" -f prisma/sql/envios-constraints.sql

# 3. Seed de monedas + permiso admin
pnpm tsx prisma/seed-envios.ts
```

Verificar:
```bash
psql "$DATABASE_URL" -c "\d+ accounts"                # debe mostrar accounts_balance_nonneg
psql "$DATABASE_URL" -c "\d+ exchange_rate_ranges"    # debe mostrar err_no_overlap (gist)
psql "$DATABASE_URL" -c "SELECT * FROM mv_balance_by_currency;"
```

## Riesgos / pendientes

- **Pendientes y orden de confirmación**: si hay varios pendientes, al confirmar el N-ésimo el `balanceAfter` se calcula con balance actual. Mostrar tooltip + `availableBalance` en formularios.
- **Refresh de matviews**: fire-and-forget tras confirmar operaciones / transferencias. Si falla, dashboard queda con datos viejos hasta el próximo refresh.
- **DB role hardening v2**: revocar UPDATE/DELETE sobre `operations` al rol app, mover esas operaciones a un rol admin.
- **"Aplicando descuento"** (columna del Excel): por ahora se modela como texto en `description`. Si crece, agregar `discountAmount Decimal?` a `Operation` en v2.

## Archivos de referencia

- Plan completo: ver path arriba.
- Schema: [prisma/schema.prisma](../prisma/schema.prisma) (sección `ENVIOS MODULE`).
- SQL manual: [prisma/sql/envios-constraints.sql](../prisma/sql/envios-constraints.sql).
- Seed: [prisma/seed-envios.ts](../prisma/seed-envios.ts).
- Registry: [src/lib/module-registry.ts](../src/lib/module-registry.ts).
- Layout: [src/app/(app)/(envios)/layout.tsx](../src/app/(app)/(envios)/layout.tsx).
- Patrón a imitar (siguientes PRs): [src/modules/pacas/](../src/modules/pacas/).

## Comandos útiles

```bash
# Validar schema
DATABASE_URL='postgresql://placeholder' pnpm prisma validate

# Regenerar cliente Prisma
DATABASE_URL='postgresql://placeholder' pnpm prisma generate

# Typecheck completo
npx tsc --noEmit

# Refrescar materialized views manualmente (debug)
psql "$DATABASE_URL" -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_balance_by_currency;"
psql "$DATABASE_URL" -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_flow;"

# Inspeccionar audit log del módulo
psql "$DATABASE_URL" -c "SELECT created_at, action, entity_type, entity_id FROM audit_log WHERE module='envios' ORDER BY created_at DESC LIMIT 20;"
```
