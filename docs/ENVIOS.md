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
| 6 | Dashboard premium (KPIs por moneda, pendientes, recientes, flujo 30d) | ✅ | `(PR 6)` |
| 7 | Hardening (concurrency tests, e2e) | ⏳ | — |
| 8 | Entregas: multi-monto, denominaciones, mensajero, comisión y foto | ✅ | (este PR) |

## Decisiones clave

- **AccountGroup**: cada hoja del Excel = un grupo, con N `Account` (una por moneda). Constraint `@@unique([groupId, currencyId])`.
- **Concurrency**: optimistic locking con `Account.version`. Neon serverless HTTP **no** soporta `SELECT FOR UPDATE` confiable.
- **OperationStatus**: `pending | confirmed | cancelled`. Solo `confirmed` mueve balance. Pendientes se confirman individualmente o en bulk.
- **Transferencia inter-moneda**: dos `Operation` (`transfer_out`, `transfer_in`) con `reference` compartido (`TRF-xxx`), conversión por `ExchangeRateRule` con rangos.
- **Tasa direccional**: `Account.exchangeRateRuleId` aplica a transferencias **outgoing** desde esa cuenta. La regla puede ir base→quote o quote→base; el server lo detecta automáticamente.
- **Bulk-confirm**: cada operación en transacción independiente, reporta exitosas y fallidas (saldo insuficiente reportado por op, no aborta el lote).
- **Entrega multi-línea**: una `CashDelivery` tiene N `CashDeliveryLine` (una por moneda, `@@unique([deliveryId, currencyId])`). El encabezado ya **no** tiene `amount`/`currencyId`.
- **Monto derivado**: `CashDeliveryLine.amount` = Σ(`unitValue` × `quantity`) del desglose. Nunca se teclea ni se acepta del cliente; se recalcula server-side en `resolveDeliveryLines`.
- **Desglose obligatorio en la app, opcional en la DB**: Zod exige ≥1 billete por línea; el trigger de cuadre hace `RETURN` si la línea no tiene desglose, para no romper las entregas migradas del modelo viejo.
- **Mensajero = `User` + `CourierProfile`**: quien tiene fila de perfil es mensajero. La comisión y moneda por defecto viven en el perfil y solo **pre-llenan** el formulario; el valor efectivo se guarda por entrega.
- **Comisión**: monto fijo por entrega, con eje de estado propio (`pending | paid`) independiente del estado de la entrega. Cancelar una entrega **revierte** una comisión ya pagada.
- **Sin conversión FX en comisiones**: los totales se agrupan por moneda. Elegir entre `ExchangeRateRule` y `ExchangeRate` sería una decisión de negocio no tomada.

## Aplicar el módulo a la DB

```bash
# 1. Schema base (modelos, enums, índices)
pnpm db:push

# 2. Constraints CHECK / EXCLUDE + materialized views
psql "$DATABASE_URL" -f prisma/sql/envios-constraints.sql

# 3. Seed de monedas + denominaciones + permiso admin
pnpm tsx prisma/seed-envios.ts
```

### Migración a entregas multi-línea (una sola vez, destructiva)

`db push` elimina `cash_deliveries.amount` y `currency_id`. Respaldar **antes**.
Ensayar la secuencia completa en una rama de Neon (`neon branches create migration-test`).

```bash
# 1. Respalda amount/currency_id ANTES de tocar el schema
psql "$DATABASE_URL" -f prisma/sql/envios-delivery-lines-pre.sql

# 2. Aplica el schema nuevo (avisará de pérdida de datos — es esperado)
pnpm db:generate && pnpm db:push
#    Si `db push` falla con P1001: el CLI de Prisma habla TCP:5432 y hay redes
#    donde ese puerto está bloqueado (el driver serverless usa WebSocket/443).
#    Alternativa equivalente, generada por el propio Prisma:
#      node scripts/apply-sql.mjs prisma/sql/envios-delivery-lines-ddl.sql

# 3. Convierte cada entrega legacy en una línea + audita la conversión
psql "$DATABASE_URL" -f prisma/sql/envios-delivery-lines-post.sql

# 4. CHECKs, funciones y CONSTRAINT TRIGGERs de entregas
psql "$DATABASE_URL" -f prisma/sql/envios-cash-delivery.sql
```

Verificado el backfill, limpiar a mano: `DROP TABLE _cash_delivery_legacy_amounts;`

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
7. **Dashboard** (`/envios/dashboard`): KPIs por moneda con saldo total, métricas (pendientes, hoy, grupos activos, cuentas, comisión por pagar), panel de pendientes top-5 con confirmar inline, feed de movimientos recientes y barras inflow/outflow 30d por moneda.
8. **Entregas** (`/envios/entregas`): entrega = N montos, cada uno con su moneda y su desglose de billetes (el monto se calcula solo). Mensajero opcional con comisión fija pre-llenada desde su perfil, foto opcional del comprobante (Vercel Blob), columna y filtro de estado de comisión, y marcado masivo de comisiones pagadas.
9. **Destinatarios** (`/envios/destinatarios`): CRUD de quien recibe el efectivo (nombre, teléfono, dirección, URL de mapa).
10. **Mensajeros** (`/envios/mensajeros`): perfil de mensajero sobre un `User` existente, con comisión y moneda por defecto y su comisión pendiente acumulada por moneda.

## Riesgos / pendientes

- **⚠ El catálogo de denominaciones debe llegar a la unidad mínima de cada moneda.** El desglose es obligatorio y el monto se deriva de él: si CUP solo tuviera 1000/500/200, una entrega de 1 250 CUP sería imposible de registrar. El seed baja hasta 1 (CUP) y 0.01 (USD). USDT es digital y usa cortes sintéticos — si aparecen más monedas digitales, conviene eximirlas del desglose obligatorio.
- **Entregas y comisiones siguen huérfanas del ledger**: ni confirmar una entrega ni marcar una comisión como pagada crea una `Operation` ni mueve saldos de `Account`. El sistema ahora registra comisiones "pagadas" sin contrapartida contable. Candidato claro a v2, conviene decidirlo antes de que haya volumen.
- **Desglose todo-o-nada**: no hay forma de registrar "1 × 1000 CUP y el resto sin especificar". Si aparece en la práctica, la salida es un `unbreakdownedAmount` nullable en la línea, sumado al total.
- **Los triggers diferidos son carga estructural del cuadre**: `db.ts` usa `PrismaNeon` (Pool/WebSocket), así que `db.$transaction` es una transacción interactiva real y `DEFERRABLE INITIALLY DEFERRED` funciona. Si alguna vez se migra al adapter HTTP, el invariante de cuadre deja de aplicarse en la DB.

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

## Dos sistemas de tasas

El repo tiene **dos** modelos de tasa de cambio independientes, cada uno para su dominio:

- **`ExchangeRateRule`** (este módulo): tasas por rangos de monto y opcionalmente por cuenta (`Account.exchangeRateRuleId`), usadas en transferencias inter-moneda de remesas. Direccional (aplica a la cuenta *outgoing*), configurada en `/envios/monedas`.
- **`ExchangeRate`** (global, módulo `currency`): una tasa única por par de monedas, usada por inventario, compras, ventas y la tienda para convertir precios y pagos a la moneda base (CUP). Configurada en `/currency/tasas`.

No comparten tablas ni lógica de resolución. Si una operación es de envíos/remesas usa `ExchangeRateRule`; si es de catálogo, POS o pagos comerciales usa `ExchangeRate`.
