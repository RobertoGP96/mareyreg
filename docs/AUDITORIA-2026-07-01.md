# Auditoría integral — Mareyway (2026-07-01)

Revisión read-only de integración y funcionamiento de módulos, con foco en tienda en línea (webstore) y control de ventas. Ningún archivo de código fue modificado. Auditado por 5 agentes en paralelo (webstore, ventas/POS, integraciones, seguridad, módulos financieros) con verificación cruzada independiente de envios/pacas/purchasing y de la API pública.

---

## Resumen ejecutivo

Lo estructural está bien: los flujos purchasing→inventory, sales→inventory y webstore→inventory/sales son atómicos (una sola `db.$transaction` por operación), con audit log y `revalidatePath` consistentes, guards de ruta completos y API keys de la tienda bien implementadas (bcrypt, prefijo, revocación). El módulo **envios** es el más sólido y su `lib/balance.ts` (optimistic locking con `version` + reintentos) es la plantilla que el resto del sistema debería copiar.

Los problemas graves se concentran en **cuatro frentes**:

1. **Autorización de server actions (CRÍTICO)** — ~75 mutaciones de dinero/stock son invocables sin sesión.
2. **Concurrencia de stock (CRÍTICO)** — el patrón read-then-write sin `version` ni condición en el `WHERE` se repite en sales, webstore, pacas, purchasing y valuación; permite doble venta / stock negativo / sobre-recepción.
3. **Confianza en el cliente en el POS (CRÍTICO)** — el precio y el monto de pago viajan desde el navegador sin recálculo server-side.
4. **Descuadre del ledger de envíos (CRÍTICO)** — un `Math.abs` destruye el signo de los ajustes pendientes: un ajuste de −500 aplica **+500** al confirmarse.

---

## 1. Hallazgos CRÍTICOS

### 1.1 Server actions sin autorización
- Causa raíz: `src/lib/audit.ts:19-24` — `getCurrentUserId()` retorna `null` sin lanzar; los guards (`requireModule`/`requireRole`) usan `redirect()` y solo protegen páginas, nunca se importan en actions. Las server actions son endpoints POST directos.
- Solo 3 funciones usan `requireCurrentUserId()` (envios: `createCashDelivery`, `markCashDeliveryDelivered`, `createRecipient`). El resto (~75) ejecuta la mutación con `userId = null`.
- Peor caso: `src/modules/webstore/actions/order-actions.ts:9-47` (`reprocessOrder`) — **cero** verificación de auth y crea facturas + movimientos de stock reales.
- Impacto alto también en: `sales/invoice-actions.ts` (createInvoice:165, registerInvoicePayment:265, cancelInvoice:322), `envios/transfer-actions.ts` y `operation-actions.ts` (todas las operaciones de balance), `inventory/stock-actions.ts:66,196`, `webstore/api-key-actions.ts:16` (un anónimo puede acuñar API keys de la tienda), `inventory/product-actions.ts:129` (cambia precios), `inventory/discount-actions.ts`.
- Además: **cero control por rol** en toda la superficie de actions — el modelo `admin/dispatcher/viewer` nunca se consulta fuera de layouts.
- **Fix**: reemplazo mecánico `getCurrentUserId()` → `requireCurrentUserId()` en toda mutación, y un helper `assertRole(roles)` que lance (no `redirect`) para operaciones sensibles.

### 1.2 Concurrencia de stock — doble venta / stock negativo
Neon HTTP no soporta `SELECT FOR UPDATE`; el proyecto exige optimistic locking con `version`, pero en el schema solo lo tienen `Discount`, `Account` y `ExchangeRateRule`. Faltan en `StockLevel`, `PacaInventory`, `ProductValuation`, `InventoryLayer`, `PurchaseOrderLine`, `Invoice`, `Customer.currentBalance`.

Instancias del bug (validar con lectura previa → `decrement` ciego):
- Sales: `invoice-actions.ts:58-71` valida y `:96-107` decrementa `StockLevel` sin condición. Dos ventas concurrentes de la última unidad pasan ambas → stock negativo con `allowNegative=false`.
- Webstore: `lib/process-order.ts:44-55` y `:76-81` — mismo patrón.
- Pacas: `paca-sale-actions.ts:19-31` y `paca-reservation-actions.ts:27-35` validan **fuera** de la transacción → doble venta / doble reserva; `PacaInventory` sin `version` ni CHECK en DB (no existe `prisma/sql/pacas-*.sql`).
- Purchasing: `goods-receipt-actions.ts:36-56` valida pendiente fuera de la tx, `:118-121` incrementa ciego → sobre-recepción concurrente (`receivedQty > quantity`).
- Valuación: `src/lib/valuation.ts` — `consumeAverage` (:98-127) y `consumeFifo` (:130-155) decrementan sin recheck (`quantityOpen` puede quedar negativo).
- `reprocessOrder` (webstore) no es atómico: doble click → dos SalesOrder/Invoice con doble descuento de stock.
- Mitigación incidental: `nextFolio` serializa parcialmente `createInvoice` vía lock de `DocumentSequence` — frágil y cuello de botella; no cubre pacas ni stock-actions.

**Fix**: patrón único — `updateMany({ where: { ..., available: { gte: qty } } })` + verificar `count === 1` (o campo `version` + 3 reintentos como `envios/lib/balance.ts`), extraído a helper compartido en `src/lib/`, más CHECKs `>= 0` en SQL crudo (`prisma/sql/inventory-constraints.sql`, `pacas-constraints.sql`).

### 1.3 POS confía en el navegador
- `invoice-actions.ts:117-118,195`: el subtotal se calcula con el `unitPrice` que envía el cliente; `getEffectivePrice` (la "única fuente de verdad" de precios) **nunca se invoca** en `createInvoice` — con devtools se factura a $0.01. El webstore sí lo hace bien (`process-order.ts:154-162` recalcula server-side): el patrón correcto ya existe en el repo.
- `immediatePayment.amount` sin validar (`:210-233`): ni `> 0` ni `<= total`; un monto inflado marca `paid` y deja `currentBalance` negativo. `registerInvoicePayment` sí valida (inconsistencia en el mismo archivo).
- Webstore equivalente: `process-order.ts:220-239` tampoco valida sobrepago, y `currency` del payload se acepta y se ignora (`schemas.ts:25`).

### 1.4 Ledger de envíos — signo destruido en ajustes
- `operation-actions.ts:81` guarda `amount: Math.abs(data.amount)`; al confirmar (`operation-actions.ts:129-135`, `transfer-actions.ts:403-406`, batch `:227`) el delta se reconstruye del valor absoluto → un ajuste pendiente de −500 **suma** 500. Descuadre silencioso del ledger.

### 1.5 Corrupción de valuación en pacas
- `paca-sale-actions.ts:102-113`: `deleteSale` repone cantidad con costo 0 (no revierte `totalCost`) → cada ciclo vender→borrar hunde el costo promedio de todo el stock restante de la categoría. `deletePacaEntry` (`paca-actions.ts:101-109`) puede dejar inventario negativo.

---

## 2. Hallazgos ALTOS

- **`cancelInvoice` no revierte stock ni valuación** (`invoice-actions.ts:320-361`): revierte balance del cliente pero el inventario descontado se pierde (sin `StockMovement` de reversión).
- **Cuentas por pagar no existe**: `purchase-queries.ts:40-52` es un stub ("Fase 4"); no hay modelo Bill/SupplierPayment, ni saldo pendiente ni conciliación de pagos a proveedor.
- **Sin cancelación/devolución de órdenes web**: una orden `processed` no puede revertirse (stock + factura + balance) más que a mano en varios módulos.
- **Kardex y ABC ciegos a pacas**: `PacaSale`/`PacaEntry` nunca emiten `StockMovement` ni `InvoiceLine` (`reporting/queries/kardex-queries.ts:19`, `abc-queries.ts:18-26`) — la trazabilidad global de inventario excluye todo el negocio de pacas.
- **Sin rate limiting** en `/api/webstore/orders` y `/api/webstore/products` (creación masiva de órdenes/facturas posible con una key válida).
- **Fuga de `error.message` crudo al cliente** (prohibido por CLAUDE.md): `webstore/order-actions.ts:39`, `api/webstore/orders/route.ts:77-83`, `sales/invoice-actions.ts:253,315,359`, `inventory/stock-actions.ts:173,287`, `purchasing/purchase-order-actions.ts:82,114,143`, `goods-receipt-actions.ts:199`, `envios/operation-actions.ts:164-166`, `transfer-actions.ts:271-273,328-330`, y menor en rutas de upload y exchange-rates.
- **Tasas inconsistentes en envíos**: `resolveTransferRate` (`transfer-actions.ts:47-51`) ignora `minInclusive`/`maxInclusive` y no detecta solape; `resolveAccountConversion` (`lib/exchange-rate.ts:214-235`) sí — un monto en el borde obtiene tasa distinta según el flujo. Además `rateOverride` sin límites ni permiso (`transfer-actions.ts:188`).
- **Aritmética monetaria en float64** transversal: balances, valuación y totales operan en `Number` sobre columnas `Decimal(20,8)` (`balance.ts:45-46`, `valuation.ts:109-110,147-148`, `invoice-actions.ts:118` — el epsilon `+0.001` en `:274` es el síntoma). Deriva acumulativa garantizada.
- **Expiración de reservas de pacas es decorativa**: sin job ni filtro; el enum ni siquiera tiene `expired` aunque la UI lo referencia (`reservation-list-client.tsx:575`). Stock retenido indefinidamente.
- **Clientes duplicados**: webstore crea `Customer` con `findFirst` por email + create (email no único, carrera posible); `PacaClient` duplica por completo a `Customer` sin vínculo.

---

## 3. Procesos innecesarios / redundantes (foco pedido)

### Webstore
1. **Catálogo calculado 2 veces por carga**: `catalogo/page.tsx:7` llama `getWebstoreCatalog()` y `getWebstoreCatalogKpis()`, y esta última re-ejecuta el catálogo completo (`catalog-queries.ts:89-96`). Los KPIs pueden derivarse en memoria.
2. **N+1 de `getEffectivePrice`** (2-4 queries por producto) en `catalog-queries.ts:56-78` y `products/route.ts:32-48`. Batchear descuentos.
3. **Filtros duplicados servidor/cliente**: `getWebstoreCatalog` implementa filtros que la UI ignora y re-filtra en memoria (`webstore-catalog-client.tsx:81-97`) — código muerto que puede divergir.
4. Lógica "SKU resuelto" duplicada entre `ordenes/[id]/page.tsx:24-31` (con N+1) y `process-order.ts:133-137`.
5. Reasignación de SKUs manual con `<Select>` de **todos** los productos, sin sugerencia por similitud.
6. Escritura de `lastUsedAt` en cada request del hot path público (`api-key.ts:27-30`).

### Sales / POS
7. Triple `update` de la misma `Invoice` en una tx (create con 0 → update totales → update paid); increment+decrement del mismo `currentBalance` para venta de contado.
8. N+1 en `dispatchLines`: producto leído 2 veces por línea (action + `resolveMethod` en valuation) — ~40 round-trips a Neon con 10 líneas.
9. Una server action por producto agregado en el POS para precio sugerido (batchear); además el `.then()` tardío puede pisar un precio ya editado por el cajero (`pos-client.tsx:128-136`).
10. **Modelo muerto `StockReservation`** (schema:962-979): no lo usa ningún flujo. Implementarlo (reserva al checkout web) o eliminarlo.
11. `registerInvoicePayment` no revalida `/accounts-receivable`.

### Pacas
12. Deletes en lote iteran N transacciones + N×3-4 `revalidatePath`.
13. Liberación de reservas vencidas 100% manual (automatizable).
14. Cálculo de avgCost duplicado en dos sitios con lógica distinta de `valuation.ts`.

### Envios
15. **Matviews muertas**: `mv_balance_by_currency` y `mv_monthly_flow` (`envios-constraints.sql:129-164`) nunca se consultan ni refrescan (el `refresh-views.ts` referenciado no existe). Borrar o cablear.
16. `resolveTransferRate` duplica ~60 líneas de `lib/exchange-rate.ts` (con semántica divergente — ver bug de tasas).
17. `revalidateAll()` invalida 5 rutas en cada mutación; dashboard usa `getOperations()` completo para KPIs agregables en SQL.

### Duplicación mayor
18. **`dispatchWebstoreLines` (process-order.ts:20-99) es un clon de `dispatchLines` (invoice-actions.ts:39-153)** — cualquier fix de concurrencia/precios hay que aplicarlo dos veces. Extraer helper compartido en `src/modules/sales/lib/` (webstore aporta el recálculo server-side de precios; sales aporta el flujo completo).

---

## 4. Integración entre módulos

**Correcto y verificado**: guards de ruta completos (11/11 grupos con `requireModule` e id correcto; `settings/` cubierto por middleware + checks por página); purchasing→inventory, sales→inventory y webstore→inventory/sales atómicos y sin sistemas paralelos de stock; CSRF cubierto (actions con origin-check de Next, API webstore con Bearer); next-auth bien configurado; sin secretos hardcodeados.

**Brechas**:
- **Pacas es una isla**: inventario paralelo sin FK a `Product`/`StockLevel`, sin `StockMovement`, `PacaClient` duplica `Customer`, `PacaEntry.supplier` es string libre, sin folio ni AR. Consecuencia directa: reportes globales ciegos (punto Altos).
- **`Company.currency` es `String @default("MXN")`** (schema:55) en vez de FK a `Currency` — viola la regla escrita del propio CLAUDE.md.
- **`formatAmount` de envios consumido por webstore** (`webstore-catalog-client.tsx:36`): promover a `src/lib/format.ts`.
- **Catálogo público engañoso multi-almacén**: `products/route.ts:35` suma stock de todos los almacenes pero el despacho descuenta de uno solo.
- **Precios por cliente invisibles en la tienda**: el catálogo cotiza anónimo pero la factura aplica `priceListId` del cliente → el comprador puede pagar un monto distinto al facturado (queda `partial` sin explicación).
- Etiquetas `module` del audit log inconsistentes: customers usa `"sales"`, suppliers usa `"purchasing"` (deberían ser `"partners"`).
- Audit de órdenes web sin atribución (`userId`/`apiKeyId` no registrados en `process-order.ts:251-262`).
- Idempotencia del POST de órdenes con carrera: `findUnique`+`create` no atómico → el duplicado simultáneo responde 500 en vez de 409 (route.ts:38-60).
- Overrides de reproceso saltan el filtro `webstoreEnabled` (`process-order.ts:126-131`).

---

## 5. Plan de remediación priorizado

### Fase 1 — Seguridad e integridad (urgente)
1. `requireCurrentUserId()` en todas las mutaciones (~75 funciones, cambio mecánico) + auth en `reprocessOrder`.
2. Fix del signo en ajustes de envíos (`Math.abs`): guardar amount con signo o delta firmado aparte.
3. Recalcular precios server-side en `createInvoice` (reusar patrón de webstore) + validar `immediatePayment.amount` (ambos canales).
4. Optimistic locking / `updateMany` condicional en `StockLevel` y `PacaInventory` + guard atómico en `reprocessOrder` + CHECKs `>= 0` en `prisma/sql/`.
5. Dejar de exponer `error.message` crudo (whitelist de errores de negocio + genérico en español).

### Fase 2 — Consistencia funcional
6. Helper compartido de despacho de líneas (unifica sales + webstore) y de decremento de stock (usado también por pacas y purchasing).
7. `cancelInvoice` con reverso de stock/valuación; acción de cancelación/devolución de orden web (transaccional y auditada).
8. Re-validación dentro de tx en recepciones de compra; `costOfGoods` en `PacaSale` para revertir valuación al borrar.
9. `assertRole()` para operaciones sensibles (borrar cuentas, editar tasas, precios, descuentos, reproceso).
10. Rate limiting en `/api/webstore/*`; responder 409 en duplicados; unificar `resolveTransferRate` sobre `resolveAccountConversion`.

### Fase 3 — Features y deuda
11. Cuentas por pagar reales (modelo Bill/SupplierPayment con saldo y pagos).
12. Expiración automática de reservas de pacas (estado `expired` + filtro/job) y `expirationDate` a `DateTime`.
13. Pacas emite `StockMovement` (kardex/ABC unificados); evaluar unificar `PacaClient` con `Customer`.
14. Migrar aritmética monetaria a `Prisma.Decimal` (empezar por envios y valuación).
15. Optimizar: KPIs de catálogo derivados en memoria, batch de `getEffectivePrice`, batch de precios en POS, deletes por lote en una tx, `lastUsedAt` con throttle.
16. Scopes y expiración para API keys; stock por almacén de despacho en catálogo público; sugerencia fuzzy de SKU; `Company.currency` → FK a `Currency`; eliminar matviews muertas y `StockReservation` (o implementarlo); Zod server-side en pacas y purchasing.
