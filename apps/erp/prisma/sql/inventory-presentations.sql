-- =============================================
-- INVENTORY MODULE - Presentaciones multi-unidad (CHECKs + backfill)
-- Apply manually after `pnpm db:push` (db push doesn't manage CHECK constraints
-- ni indices parciales). Idempotente: se puede re-ejecutar sin efectos dobles.
-- Run: psql "$DATABASE_URL" -f prisma/sql/inventory-presentations.sql
--
-- Invariantes:
--   * factor > 0: el factor convierte cantidades de presentacion a unidad base;
--     un factor <= 0 corromperia stock y valuacion.
--   * Exactamente una presentacion base por producto (indice unico parcial):
--     la base (factor 1) es la unidad en la que se lleva stock/kardex.
--   * unit_factor > 0 y base_quantity >= 0 en lineas de venta: snapshot de la
--     conversion al momento de la venta; el historico nunca se recalcula.
-- =============================================

ALTER TABLE product_presentations
  DROP CONSTRAINT IF EXISTS chk_product_presentations_factor_pos;
ALTER TABLE product_presentations
  ADD CONSTRAINT chk_product_presentations_factor_pos
  CHECK (factor > 0);

ALTER TABLE product_presentations
  DROP CONSTRAINT IF EXISTS chk_product_presentations_retail_price_nonneg;
ALTER TABLE product_presentations
  ADD CONSTRAINT chk_product_presentations_retail_price_nonneg
  CHECK (retail_price >= 0);

ALTER TABLE product_presentations
  DROP CONSTRAINT IF EXISTS chk_product_presentations_wholesale_price_nonneg;
ALTER TABLE product_presentations
  ADD CONSTRAINT chk_product_presentations_wholesale_price_nonneg
  CHECK (wholesale_price IS NULL OR wholesale_price >= 0);

-- Una sola presentacion base por producto.
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_presentations_base
  ON product_presentations (product_id)
  WHERE is_base;

ALTER TABLE invoice_lines
  DROP CONSTRAINT IF EXISTS chk_invoice_lines_unit_factor_pos;
ALTER TABLE invoice_lines
  ADD CONSTRAINT chk_invoice_lines_unit_factor_pos
  CHECK (unit_factor > 0);

ALTER TABLE invoice_lines
  DROP CONSTRAINT IF EXISTS chk_invoice_lines_base_quantity_nonneg;
ALTER TABLE invoice_lines
  ADD CONSTRAINT chk_invoice_lines_base_quantity_nonneg
  CHECK (base_quantity >= 0);

ALTER TABLE sales_order_lines
  DROP CONSTRAINT IF EXISTS chk_sales_order_lines_unit_factor_pos;
ALTER TABLE sales_order_lines
  ADD CONSTRAINT chk_sales_order_lines_unit_factor_pos
  CHECK (unit_factor > 0);

ALTER TABLE sales_order_lines
  DROP CONSTRAINT IF EXISTS chk_sales_order_lines_base_quantity_nonneg;
ALTER TABLE sales_order_lines
  ADD CONSTRAINT chk_sales_order_lines_base_quantity_nonneg
  CHECK (base_quantity >= 0);

-- Backfill: presentacion base (factor 1) para todo producto existente.
-- name = unit del producto; precios desde sale_price/secondary_price.
-- Incluye servicios: la regla es "todo producto tiene exactamente 1 base".
INSERT INTO product_presentations
  (product_id, name, factor, retail_price, wholesale_price, is_base, is_active, sort_order)
SELECT
  p.product_id,
  p.unit,
  1,
  COALESCE(p.sale_price, 0),
  p.secondary_price,
  true,
  true,
  0
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM product_presentations pp
  WHERE pp.product_id = p.product_id AND pp.is_base
);

-- Backfill de lineas historicas: se vendieron en unidad base (factor 1).
-- Las lineas legitimas siempre tienen quantity > 0, por lo que base_quantity = 0
-- solo puede ser una fila pre-migracion (o creada antes del deploy del backend).
UPDATE invoice_lines
SET base_quantity = quantity
WHERE base_quantity = 0;

UPDATE sales_order_lines
SET base_quantity = quantity
WHERE base_quantity = 0;
