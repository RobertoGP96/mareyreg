# Módulo Envíos · Estado vivo

Módulo de envío de efectivo. Reemplaza el flujo en Excel `Operaciones Marey 2025 septiembre.xlsx` (32 hojas, una por grupo/persona).

Plan completo de diseño: `C:/Users/PC/.claude/plans/c-users-pc-onedrive-gerel-marey-operaci-toasty-pnueli.md`

## Estado

| PR | Contenido | Estado | Commit |
|---|---|---|---|
| 1 | Schema + SQL + seed + registry + layout | ✅ | `8008503` |
| 2 | CRUD Monedas + Grupos | ✅ | `106e8b4` |
| 3 | Cuentas + Tasas + helpers (resolveRate, applyDelta) | ✅ | `5ec4a93` |
| 4 | Operaciones (depósito/retiro/ajuste) con form único | ✅ | `9f52ca8` |
| 5 | Transferencias entre cuentas + Pendientes + bulk-confirm | ✅ | `07c5eb6` |
| 6 | Dashboard premium (KPIs por moneda, pendientes, recientes, flujo 30d) | ✅ | (este PR) |
| 7 | Hardening (concurrency tests, e2e) | ⏳ | — |

## Decisiones clave

- **AccountGroup**: cada hoja del Excel = un grupo, con N `Account` (una por moneda). Constraint `@@unique([groupId, currencyId])`.
- **Concurrency**: optimistic locking con `Account.version`. Neon serverless HTTP **no** soporta `SELECT FOR UPDATE` confiable.
- **OperationStatus**: `pending | confirmed | cancelled`. Solo `confirmed` mueve balance. Pendientes se confirman individualmente o en bulk.
- **Transferencia inter-moneda**: dos `Operation` (`transfer_out`, `transfer_in`) con `reference` compartido (`TRF-xxx`), conversión por `ExchangeRateRule` con rangos.
- **Tasa direccional**: `Account.exchangeRateRuleId` aplica a transferencias **outgoing** desde esa cuenta. La regla puede ir base→quote o quote→base; el server lo detecta automáticamente.
- **Bulk-confirm**: cada operación en transacción independiente, reporta exitosas y fallidas (saldo insuficiente reportado por op, no aborta el lote).

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

## Recorrido funcional

1. **Monedas** (`/envios/monedas`): catálogo USD, USDT, CUP, EUR, CAN. Toggle activo, símbolo, decimales 0-8.
2. **Grupos** (`/envios/grupos`): cada grupo = una "hoja" del Excel. Tiene un responsable (User), código único, descripción. La lista muestra los saldos por moneda inline (chips).
3. **Cuentas** (`/envios/cuentas`): una por par grupo×moneda. Saldo inicial opcional crea Operation `adjustment, status=confirmed`. Regla de tasa opcional aplica a transferencias outgoing.
4. **Tasas de cambio** (`/envios/tasas`): reglas por par de monedas con rangos `[min, max)`. Validación cliente de no-solape + EXCLUDE constraint en DB.
5. **Operaciones** (`/envios/operaciones`): form único con tabs Depósito | Retiro | Ajuste, switch "Guardar como pendiente", switch "Continuar registrando" para flujo Excel-style. Botón aparte "Transferencia" abre el form con preview de tasa en vivo.
6. **Pendientes** (`/envios/pendientes`): tabla con checkbox por fila + bulk-confirm flotante. Reporte individual de fallos en lote (ej. saldo insuficiente).
7. **Dashboard** (`/envios/dashboard`): KPIs por moneda con saldo total, métricas (pendientes, hoy, grupos activos, cuentas), panel de pendientes top-5 con confirmar inline, feed de movimientos recientes y barras inflow/outflow 30d por moneda.

## Riesgos / pendientes

- **Pendientes y orden de confirmación**: si hay varios pendientes, al confirmar el N-ésimo el `balanceAfter` se calcula con balance actual (no con el del momento de creación). Mostrado en operations/pending list con tooltip implícito. UI muestra `availableBalance = balance − reserved` en formularios para evitar sorpresas.
- **Refresh de matviews**: el módulo lee directamente las tablas (no las matviews) para no depender del refresh. Las matviews siguen disponibles para reportes pesados.
- **DB role hardening v2**: revocar UPDATE/DELETE sobre `operations` al rol app, mover a un rol admin. v1 confía en action layer + audit log.
- **"Aplicando descuento"** (columna del Excel): por ahora se modela como texto en `description`. Si crece, agregar `discountAmount Decimal?` a `Operation` en v2.
- **Transferencias quote→base**: el código detecta dirección automáticamente, pero la división `amount / rate` para invertir puede acumular pequeños errores de precisión. v2 considerar siempre normalizar a la base.

## Archivos clave

- Plan completo: ver path arriba.
- Schema: [prisma/schema.prisma](../prisma/schema.prisma) (sección `ENVIOS MODULE`).
- SQL manual: [prisma/sql/envios-constraints.sql](../prisma/sql/envios-constraints.sql).
- Seed: [prisma/seed-envios.ts](../prisma/seed-envios.ts).
- Registry: [src/lib/module-registry.ts](../src/lib/module-registry.ts).
- Layout: [src/app/(app)/(envios)/layout.tsx](../src/app/(app)/(envios)/layout.tsx).
- Helpers críticos:
  - [lib/balance.ts](../src/modules/envios/lib/balance.ts) — `applyDelta` con optimistic locking.
  - [lib/exchange-rate.ts](../src/modules/envios/lib/exchange-rate.ts) — `resolveRate` por rangos.
  - [lib/schemas.ts](../src/modules/envios/lib/schemas.ts) — Zod schemas compartidos.
- Patrón a imitar para futuros módulos: [src/modules/pacas/](../src/modules/pacas/) y este mismo módulo.

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

## v1 vs v2

**v1 (PRs 1-6, este sprint)**: módulo end-to-end funcional reemplazando el Excel.

**v2 (futuro)**:
- Cmd+K palette + atajos para "Nueva operación rápida".
- Calculadora rápida en `/envios/tasas` (input monto → resultado convertido).
- Number-line visual de rangos en form de tasas.
- Hover-precision tooltip en montos (`Decimal(20,8)` completo).
- Animación `AmountChangeFlash` al confirmar.
- Audit tooltip por operación (creado por X, confirmado por Y, IP).
- Dual-currency display opcional ("≈ $X USD").
- Print statement por grupo.
- DB role hardening (revocar UPDATE/DELETE sobre operations al rol app).
- Tests de concurrencia automatizados (PR 7).
- E2E con Playwright para flujos críticos.
