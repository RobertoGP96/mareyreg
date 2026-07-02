-- =============================================
-- PURCHASING MODULE - Presentaciones en compras (CHECKs + backfill)
-- Apply manually after `pnpm db:push`. Idempotente.
-- Run: psql "$DATABASE_URL" -f prisma/sql/purchasing-presentations.sql
--
-- Misma semantica que en ventas: quantity/unit_cost en la unidad comprada
-- (presentacion), base_quantity = quantity * unit_factor en unidad base.
-- El stock siempre entra en unidad base al recibir.
-- =============================================

ALTER TABLE purchase_order_lines
  DROP CONSTRAINT IF EXISTS chk_purchase_order_lines_unit_factor_pos;
ALTER TABLE purchase_order_lines
  ADD CONSTRAINT chk_purchase_order_lines_unit_factor_pos
  CHECK (unit_factor > 0);

ALTER TABLE purchase_order_lines
  DROP CONSTRAINT IF EXISTS chk_purchase_order_lines_base_quantity_nonneg;
ALTER TABLE purchase_order_lines
  ADD CONSTRAINT chk_purchase_order_lines_base_quantity_nonneg
  CHECK (base_quantity >= 0);

ALTER TABLE goods_receipt_lines
  DROP CONSTRAINT IF EXISTS chk_goods_receipt_lines_unit_factor_pos;
ALTER TABLE goods_receipt_lines
  ADD CONSTRAINT chk_goods_receipt_lines_unit_factor_pos
  CHECK (unit_factor > 0);

ALTER TABLE goods_receipt_lines
  DROP CONSTRAINT IF EXISTS chk_goods_receipt_lines_base_quantity_nonneg;
ALTER TABLE goods_receipt_lines
  ADD CONSTRAINT chk_goods_receipt_lines_base_quantity_nonneg
  CHECK (base_quantity >= 0);

-- Backfill: lineas historicas se compraron en unidad base (factor 1).
UPDATE purchase_order_lines
SET base_quantity = quantity
WHERE base_quantity = 0;

UPDATE goods_receipt_lines
SET base_quantity = quantity
WHERE base_quantity = 0;
