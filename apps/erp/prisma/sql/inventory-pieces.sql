-- =============================================
-- INVENTORY MODULE - Registro de pesajes individuales (product_pieces)
-- Apply manually after `pnpm db:push` (db push doesn't manage CHECK constraints
-- ni índices parciales).
-- Idempotente: se puede re-ejecutar sin efectos dobles.
-- Run: psql "$DATABASE_URL" -f prisma/sql/inventory-pieces.sql
--
-- Invariantes:
--   * weight_kg > 0: una pieza siempre tiene peso real de báscula.
--   * piece_count >= 1: piezas fungibles que representa el registro (1 = pieza
--     suelta, pieces_per_unit = caja pesada completa).
--   * status = 'sold' exige vínculo a la línea que la consumió (factura POS o
--     línea de pedido webstore).
--   * status = 'disposed' exige disposed_at.
--   * Índice parcial sobre disponibles: hot path del POS y del catálogo webstore.
-- =============================================

ALTER TABLE product_pieces
  DROP CONSTRAINT IF EXISTS chk_product_pieces_weight_pos;
ALTER TABLE product_pieces
  ADD CONSTRAINT chk_product_pieces_weight_pos
  CHECK (weight_kg > 0);

ALTER TABLE product_pieces
  DROP CONSTRAINT IF EXISTS chk_product_pieces_count_pos;
ALTER TABLE product_pieces
  ADD CONSTRAINT chk_product_pieces_count_pos
  CHECK (piece_count >= 1);

ALTER TABLE product_pieces
  DROP CONSTRAINT IF EXISTS chk_product_pieces_sold_link;
ALTER TABLE product_pieces
  ADD CONSTRAINT chk_product_pieces_sold_link
  CHECK (status <> 'sold' OR invoice_line_id IS NOT NULL OR sales_order_line_id IS NOT NULL);

ALTER TABLE product_pieces
  DROP CONSTRAINT IF EXISTS chk_product_pieces_disposed_at;
ALTER TABLE product_pieces
  ADD CONSTRAINT chk_product_pieces_disposed_at
  CHECK (status <> 'disposed' OR disposed_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_product_pieces_available
  ON product_pieces (product_id, warehouse_id)
  WHERE status = 'available';
