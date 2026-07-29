# Plan completo de remediación y mejoras — Mareyway

Basado en la auditoría integral del 2026-07-01 ([AUDITORIA-2026-07-01.md](AUDITORIA-2026-07-01.md)). Organizado en 4 fases; cada ítem está pensado como un PR pequeño y vertical (schema/SQL → backend → UI → polish). Verificación estándar de cada PR: `pnpm prisma validate` (si toca schema), `npx tsc --noEmit`, prueba manual de la ruta afectada en viewport 375px.

**Estado**: Fase 1 en ejecución (agentes en curso). Fases 2-4 pendientes de aprobación.

---

## Fase 1 — Seguridad e integridad (EN CURSO)

Objetivo: cerrar los 4 hallazgos críticos. Sin cambios de schema (se usa decremento condicional atómico en lugar de campo `version` para no requerir migración).

| # | PR | Alcance | Archivos clave | Criterio de aceptación |
|---|----|---------|----------------|------------------------|
| 1.1 | `fix(auth): requireCurrentUserId en mutaciones` | Reemplazo `getCurrentUserId()` → `requireCurrentUserId()` en ~75 mutaciones de todos los módulos; auth explícita en `reprocessOrder` | `src/modules/*/actions/*.ts`, `src/lib/audit.ts` | Ninguna server action que mute datos ejecuta con `userId = null`; invocar sin sesión retorna error de sesión en español |
| 1.2 | `fix(envios): signo de ajustes pendientes` | Eliminar el `Math.abs` que destruye el signo; crear-pendiente-confirmar debe producir el mismo delta que crear-confirmada | `operation-actions.ts:81,227`, `transfer-actions.ts:403-406`, `prisma/sql/envios-constraints.sql` | Un ajuste de −500 pendiente aplica −500 al confirmarse, en los 3 caminos (directa, pendiente+confirm, bulk) |
| 1.3 | `fix(sales): precios server-side y pago validado` | `createInvoice` calcula precio efectivo server-side; overrides de precio quedan auditados; `immediatePayment.amount > 0` y `<= total` | `invoice-actions.ts`, `effective-price.ts` | No se puede facturar bajo precio de catálogo sin rastro en audit; sobrepago rechazado |
| 1.4 | `fix(stock): decremento condicional atómico` | `updateMany({ where: { qty: { gte } } })` + check de count en sales, webstore, pacas, purchasing y valuación; CHECKs SQL defensivos | `dispatchLines`, `process-order.ts`, `paca-sale/reservation-actions.ts`, `goods-receipt-actions.ts`, `src/lib/valuation.ts`, `prisma/sql/{inventory,pacas}-constraints.sql` | Dos ventas concurrentes de la última unidad: una gana, la otra recibe error de stock; sobre-recepción concurrente bloqueada |
| 1.5 | `fix: no exponer error.message crudo` | Whitelist de errores de negocio + mensaje genérico en español; `console.error` con el real | sales, inventory, purchasing, envios, webstore (actions + `api/webstore/orders/route.ts`) | Ningún catch retorna `error.message` de Prisma al cliente |
| 1.6 | `fix(webstore): reprocessOrder atómico + 409 en duplicados` | Claim atómico de status antes de procesar; P2002 → 409; audit con atribución (userId/apiKeyId) | `order-actions.ts`, `orders/route.ts`, `process-order.ts` | Doble click en reprocesar no duplica factura/stock; POST duplicado concurrente responde 409 |

**Post-Fase 1 (manual)**: aplicar con `psql` los nuevos `prisma/sql/inventory-constraints.sql` y `pacas-constraints.sql` (y el de envios si cambió).

---

## Fase 2 — Consistencia funcional y roles

Objetivo: cerrar los hallazgos ALTOS de integridad de negocio y unificar la lógica duplicada para que los fixes de Fase 1 vivan en un solo lugar.

### 2.1 `feat(auth): assertRole para actions` (prerequisito de varios)
- Nuevo helper en `src/lib/auth-guard.ts`: `assertRole(roles: Role[])` que **lanza** (no `redirect`).
- Aplicar a operaciones sensibles: borrar cuentas/monedas (envios), editar/borrar tasas de cambio, cambiar precios (`updateProduct`), descuentos, `reprocessOrder`, crear/revocar API keys, cancelar facturas.
- Criterio: un usuario `viewer` no puede ejecutar ninguna de esas mutaciones.

### 2.2 `refactor(sales): despacho de líneas unificado`
- Extraer `dispatchInvoiceLines(tx, …)` a `src/modules/sales/lib/dispatch-lines.ts` y que `createInvoice` y `processWebstoreOrder` lo consuman (hoy `dispatchWebstoreLines` es un clon).
- Incluir en el helper el recálculo server-side de precios (aportación de webstore) y el decremento condicional (Fase 1).
- Criterio: una sola implementación; ambos flujos pasan las mismas validaciones.

### 2.3 `feat(sales): cancelación con reverso de stock`
- `cancelInvoice` crea `StockMovement` de entrada reversa y restaura `StockLevel` + valuación (o, si se prefiere flujo formal, modelo `ReturnDoc`).
- Criterio: cancelar una factura pending deja stock y valuación como antes de la venta; auditado.

### 2.4 `feat(webstore): cancelación/devolución de orden web`
- Action `cancelWebstoreOrder`: revierte stock (vía 2.3/2.2), anula factura, ajusta `currentBalance`, marca el log; transaccional y auditado.
- UI en `webstore/ordenes/[id]` con confirmación.
- Criterio: una orden `processed` puede revertirse completa en un click, sin pasos manuales en otros módulos.

### 2.5 `fix(pacas): valuación reversible`
- Guardar `costOfGoods` en `PacaSale` al vender; `deleteSale`/cancelación repone cantidad **y** `totalCost` proporcional (hoy repone a costo 0 y corrompe el promedio).
- Extraer `weightedAverageCost()` compartido (hoy duplicado en 2 sitios).
- Criterio: ciclo vender→borrar deja `totalCost`/avgCost idénticos al estado previo.

### 2.6 `fix(envios): tasas consistentes`
- Unificar `resolveTransferRate` sobre `resolveAccountConversion`/`isAmountInRule` (hoy divergen en bounds inclusivos y detección de solape).
- `rateOverride`: validar desviación máxima vs la regla vigente y/o exigir rol admin (usa 2.1).
- Criterio: mismo monto en borde de rango obtiene la misma tasa en transferencia y conversión.

### 2.7 `feat(webstore): rate limiting API pública`
- Rate limiting por API key + IP en `/api/webstore/orders` y `/api/webstore/products` (p. ej. `@upstash/ratelimit` o ventana deslizante en DB), respuesta 429 con `Retry-After`.
- Criterio: ráfagas por encima del umbral reciben 429; tráfico normal no se afecta.

### 2.8 `fix(webstore): coherencia catálogo público`
- Stock por almacén de despacho (configurable) en `GET /products` en lugar de sumar todos los almacenes.
- Overrides de reproceso validan `webstoreEnabled`.
- Precios por cliente: cotizar con `customerId` cuando la API lo identifique, o documentar que el catálogo es precio de lista.
- Criterio: lo que la tienda muestra disponible coincide con lo que el despacho puede descontar.

### 2.9 `fix(inventory): POS no filtra costos y serializa Decimal`
- `pos/page.tsx`: `Number(salePrice)` y **eliminar `costPrice` del payload** al cliente.
- Arreglar la carrera del precio sugerido (el `.then()` tardío no debe pisar un precio editado; re-evaluar descuento al cambiar cantidad).
- Criterio: el navegador nunca recibe `costPrice`; el precio editado por el cajero no se sobrescribe.

---

## Fase 3 — Features nuevas

### 3.1 `feat(purchasing): cuentas por pagar reales`
- Schema: `SupplierBill` (ligada a PO/recepción, con `total`, `paid`, `balanceDue`, `version`) + `SupplierPayment`; cascada `Restrict`.
- Actions: crear bill al recibir (o manual), registrar pago (tx + audit + locking), listado con aging.
- UI: `/accounts-payable` deja de ser stub; cards mobile + tabla desktop.
- Criterio: saldo por proveedor consultable y conciliado con pagos; el stub actual queda reemplazado.

### 3.2 `feat(pacas): expiración automática de reservas`
- Migrar `PacaReservation.expirationDate` de `String` a `DateTime`; añadir estado `expired` al enum (la UI ya lo referencia).
- Expiración perezosa: al leer disponibilidad/reservas, liberar (`reserved` → `available`) las vencidas dentro de una tx con decremento condicional; opcional cron de respaldo.
- Criterio: una reserva vencida libera stock sin intervención manual.

### 3.3 `feat(pacas): integración con el resto del sistema`
- Emitir `StockMovement` con discriminador (`sourceType: "paca"`) en entradas/ventas de pacas → kardex y ABC dejan de ser ciegos al módulo.
- Evaluar unificación `PacaClient` → `Customer` (migración de datos + FK); `PacaEntry.supplier` → FK a `Supplier`.
- Criterio: kardex global incluye pacas; sin directorios de clientes duplicados.

### 3.4 `feat(webstore): API keys con scopes y expiración`
- Campos `scopes` (read_catalog / create_orders) y `expiresAt` en `WebstoreApiKey`; validación en `resolveApiKey`.
- UI de rotación guiada (crear nueva → revocar vieja).
- Criterio: una key de solo catálogo no puede crear órdenes.

### 3.5 `feat(webstore): reservas al checkout` (opcional, evaluar demanda)
- Usar el modelo `StockReservation` (hoy muerto) para retener stock entre checkout externo y webhook; TTL corto con liberación automática.
- Si se descarta: eliminar `StockReservation` del schema (decisión explícita, no dejarlo muerto).

### 3.6 `feat(envios): entregas de efectivo ligadas al ledger` (opcional)
- Vincular `CashDelivery` a cuenta origen; marcar "delivered" genera el withdrawal automáticamente.
- Criterio: el cuadre efectivo↔cuentas deja de ser manual.

---

## Fase 4 — Rendimiento, limpieza y deuda técnica

### 4.1 Rendimiento webstore
- KPIs del catálogo derivados en memoria de las filas ya cargadas (hoy la página calcula el catálogo 2 veces).
- Batch de `getEffectivePrice` (una query de descuentos para todos los productos) en catálogo interno y `GET /products`.
- `lastUsedAt` de API keys con throttle (una escritura/hora) o fire-and-forget.
- Decidir dueño único de filtros del catálogo (servidor o cliente) y borrar el otro.

### 4.2 Rendimiento sales
- `dispatchLines`: batch de productos (`findMany`) en vez de N+1; eliminar el `findUnique` duplicado de `resolveMethod`.
- Consolidar el triple update de `Invoice` y el increment+decrement del mismo `currentBalance` en la misma tx.
- Precio sugerido del POS en batch (al cargar o al abrir checkout).
- `registerInvoicePayment` revalida `/accounts-receivable` (si no quedó en Fase 1).

### 4.3 Rendimiento pacas/envios
- Deletes por lote en UNA transacción con un solo `revalidatePath`.
- Dashboard de pacas con `groupBy`/`aggregate` en vez de traer 200 filas; `getSalesStats` con `aggregate`.
- Envios: `revalidateAll()` → revalidación selectiva por ruta; KPIs de dashboard con agregados SQL.

### 4.4 Limpieza
- Eliminar matviews muertas de `envios-constraints.sql` (o cablearlas con refresh, decisión explícita).
- Promover `formatAmount`/`formatCurrencyCode` de `envios/lib/format.ts` a `src/lib/format.ts` y actualizar imports (webstore ya lo consume cross-módulo).
- `Company.currency: String` → FK a `Currency` (o comentario en schema documentando la excepción).
- Etiquetas `module` del audit log: customers/suppliers → `"partners"` (o documentar la semántica).
- Unificar helper "SKU resuelto" de webstore (duplicado en page y process-order, con N+1).
- Zod server-side en pacas y purchasing donde falte (si no quedó en Fase 1).
- POS: adoptar `PageHeader` + `ResponsiveFormDialog` (checkout como sheet en mobile).
- Sugerencia fuzzy de producto al reasignar SKUs no resueltos en órdenes web.

### 4.5 Deuda mayor (planificar aparte, no PR suelto)
- **Aritmética monetaria a `Prisma.Decimal`** en balances, valuación y totales (hoy float64 con drift acumulativo; el epsilon `+0.001` en invoice-actions es el síntoma). Empezar por `envios/lib/balance.ts` y `src/lib/valuation.ts`.
- Añadir campo `version` a `StockLevel`, `PacaInventory`, `ProductValuation`, `InventoryLayer` para locking uniforme estilo `envios/lib/balance.ts` (el decremento condicional de Fase 1 cubre lo urgente; `version` da detección de conflicto generalizada).
- Evaluar migración de pacas a `Product`/`StockLevel` (proyecto propio).

---

## Orden y dependencias

```
Fase 1 (en curso) ──> 2.1 assertRole ──> 2.6 (override), 3.4 (keys)
                 └──> 2.2 despacho unificado ──> 2.3 cancelación factura ──> 2.4 cancelación orden web
                 └──> 2.5, 2.7, 2.8, 2.9 (independientes)
Fase 3: 3.1 y 3.2 independientes; 3.3 depende de decisión de negocio; 3.5/3.6 opcionales
Fase 4: tras estabilizar Fase 2; 4.5 planificación propia
```

## Verificación global por fase
1. `pnpm prisma validate && pnpm prisma generate`
2. `npx tsc --noEmit`
3. Aplicar SQL nuevo de `prisma/sql/` con `psql` (manual, revisado)
4. Smoke test manual: POS venta contado/crédito, orden webstore vía API (creación + duplicado + reproceso), venta y reserva de pacas, recepción de compra, operación/transferencia/ajuste en envíos — en 375px
5. Commits `fix(<modulo>):` / `feat(<modulo>):` por PR; push solo con confirmación
