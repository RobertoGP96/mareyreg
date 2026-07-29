-- Constraints defensivos para pacas y purchasing.
-- `db push` no aplica CHECK constraints, asi que este script se debe correr
-- manualmente con psql contra la base de datos (Neon).
--
-- NO SE APLICA AUTOMATICAMENTE. Revisar y ejecutar manualmente:
--   psql "$DATABASE_URL" -f prisma/sql/pacas-constraints.sql
--
-- Estas CHECK son una segunda linea de defensa detras del optimistic locking
-- y los updateMany condicionales en las server actions (paca-sale-actions.ts,
-- paca-reservation-actions.ts, paca-actions.ts, goods-receipt-actions.ts).
-- Protegen contra bugs futuros o escrituras directas a la base que salten
-- la capa de aplicacion.

-- =============================================
-- paca_inventory (modelo PacaInventory)
-- =============================================

ALTER TABLE paca_inventory
  ADD CONSTRAINT paca_inventory_available_nonneg CHECK (available >= 0);

ALTER TABLE paca_inventory
  ADD CONSTRAINT paca_inventory_reserved_nonneg CHECK (reserved >= 0);

ALTER TABLE paca_inventory
  ADD CONSTRAINT paca_inventory_sold_nonneg CHECK (sold >= 0);

-- =============================================
-- purchase_order_lines (modelo PurchaseOrderLine)
-- =============================================

ALTER TABLE purchase_order_lines
  ADD CONSTRAINT purchase_order_lines_received_qty_nonneg CHECK (received_qty >= 0);

ALTER TABLE purchase_order_lines
  ADD CONSTRAINT purchase_order_lines_received_qty_le_quantity CHECK (received_qty <= quantity);
