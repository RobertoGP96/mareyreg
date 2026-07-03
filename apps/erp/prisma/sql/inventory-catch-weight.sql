-- =============================================
-- INVENTORY MODULE - Catch weight (productos de peso variable)
-- Apply manually after `pnpm db:push` (db push doesn't manage CHECK constraints).
-- Idempotente: se puede re-ejecutar sin efectos dobles.
-- Run: psql "$DATABASE_URL" -f prisma/sql/inventory-catch-weight.sql
--
-- Invariantes:
--   * pieces_per_unit >= 1 cuando no es null: es un conteo de piezas fungibles
--     por unidad de presentación (Caja = N piezas), nunca fraccional ni cero.
--   * current_pieces >= 0: contador de piezas fungibles, nunca negativo.
--   * pieces (líneas de venta/compra/movimientos) IS NULL o > 0: pieces IS NOT
--     NULL es el discriminador de línea catch-weight; una línea catch-weight
--     siempre involucra al menos 1 pieza.
-- =============================================

ALTER TABLE product_presentations
  DROP CONSTRAINT IF EXISTS chk_product_presentations_pieces_per_unit_pos;
ALTER TABLE product_presentations
  ADD CONSTRAINT chk_product_presentations_pieces_per_unit_pos
  CHECK (pieces_per_unit IS NULL OR pieces_per_unit >= 1);

ALTER TABLE stock_levels
  DROP CONSTRAINT IF EXISTS chk_stock_levels_current_pieces_nonneg;
ALTER TABLE stock_levels
  ADD CONSTRAINT chk_stock_levels_current_pieces_nonneg
  CHECK (current_pieces >= 0);

ALTER TABLE invoice_lines
  DROP CONSTRAINT IF EXISTS chk_invoice_lines_pieces_pos;
ALTER TABLE invoice_lines
  ADD CONSTRAINT chk_invoice_lines_pieces_pos
  CHECK (pieces IS NULL OR pieces > 0);

ALTER TABLE sales_order_lines
  DROP CONSTRAINT IF EXISTS chk_sales_order_lines_pieces_pos;
ALTER TABLE sales_order_lines
  ADD CONSTRAINT chk_sales_order_lines_pieces_pos
  CHECK (pieces IS NULL OR pieces > 0);

ALTER TABLE goods_receipt_lines
  DROP CONSTRAINT IF EXISTS chk_goods_receipt_lines_pieces_pos;
ALTER TABLE goods_receipt_lines
  ADD CONSTRAINT chk_goods_receipt_lines_pieces_pos
  CHECK (pieces IS NULL OR pieces > 0);

ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS chk_stock_movements_pieces_pos;
ALTER TABLE stock_movements
  ADD CONSTRAINT chk_stock_movements_pieces_pos
  CHECK (pieces IS NULL OR pieces > 0);
