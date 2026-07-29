-- =============================================
-- INVENTORY MODULE - CHECKs defensivos para no dejar cantidades negativas
-- Apply manually after `pnpm db:push` (db push doesn't manage CHECK constraints).
-- Run: psql "$DATABASE_URL" -f prisma/sql/inventory-constraints.sql
--
-- NOTA sobre stock_levels.current_quantity:
--   No es factible aplicar un CHECK simple `current_quantity >= 0` a nivel de
--   tabla porque la politica de permitir negativo (`allow_negative_stock`) vive
--   en la tabla `products` (Product.allowNegative), no en `stock_levels`, y
--   Postgres CHECK constraints no pueden referenciar otra tabla. Aplicar ese
--   invariante requeriria un trigger (fuera de alcance de este archivo) que
--   haga JOIN contra products.allow_negative_stock antes de rechazar el UPDATE.
--   La proteccion contra negativos para el caso allowNegative=false ya se
--   garantiza en la capa de aplicacion (server actions con decremento
--   condicional `updateMany` + verificacion de `count`).
--
--   inventory_layers.quantity_open y product_valuations.total_qty SI son
--   invariantes incondicionales (no dependen de allowNegative: representan
--   costo/cantidad realmente en existencia via metodo de valuacion), por lo
--   que se les aplica CHECK >= 0 directamente.
-- =============================================

ALTER TABLE inventory_layers
  DROP CONSTRAINT IF EXISTS chk_inventory_layers_quantity_open_nonneg;
ALTER TABLE inventory_layers
  ADD CONSTRAINT chk_inventory_layers_quantity_open_nonneg
  CHECK (quantity_open >= 0);

ALTER TABLE product_valuations
  DROP CONSTRAINT IF EXISTS chk_product_valuations_total_qty_nonneg;
ALTER TABLE product_valuations
  ADD CONSTRAINT chk_product_valuations_total_qty_nonneg
  CHECK (total_qty >= 0);
