-- =============================================
-- CURRENCY MODULE - CHECKs defensivos para tasa de cambio global manual
-- Apply manually after `pnpm db:push` (db push doesn't manage CHECK constraints).
-- Run: psql "$DATABASE_URL" -f prisma/sql/currency-constraints.sql
-- =============================================

ALTER TABLE exchange_rates
  DROP CONSTRAINT IF EXISTS chk_exchange_rates_rate_pos;
ALTER TABLE exchange_rates
  ADD CONSTRAINT chk_exchange_rates_rate_pos
  CHECK (rate > 0);

ALTER TABLE exchange_rates
  DROP CONSTRAINT IF EXISTS chk_exchange_rates_currencies_distinct;
ALTER TABLE exchange_rates
  ADD CONSTRAINT chk_exchange_rates_currencies_distinct
  CHECK (base_currency_id <> quote_currency_id);

ALTER TABLE exchange_rate_history
  DROP CONSTRAINT IF EXISTS chk_exchange_rate_history_new_rate_pos;
ALTER TABLE exchange_rate_history
  ADD CONSTRAINT chk_exchange_rate_history_new_rate_pos
  CHECK (new_rate > 0);

ALTER TABLE exchange_rate_history
  DROP CONSTRAINT IF EXISTS chk_exchange_rate_history_old_rate_pos;
ALTER TABLE exchange_rate_history
  ADD CONSTRAINT chk_exchange_rate_history_old_rate_pos
  CHECK (old_rate IS NULL OR old_rate > 0);

-- =============================================
-- Fase 2 — Compras y costos duales USD/CUP
-- =============================================

ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS chk_purchase_orders_exchange_rate_pos;
ALTER TABLE purchase_orders
  ADD CONSTRAINT chk_purchase_orders_exchange_rate_pos
  CHECK (exchange_rate IS NULL OR exchange_rate > 0);

ALTER TABLE goods_receipts
  DROP CONSTRAINT IF EXISTS chk_goods_receipts_exchange_rate_pos;
ALTER TABLE goods_receipts
  ADD CONSTRAINT chk_goods_receipts_exchange_rate_pos
  CHECK (exchange_rate IS NULL OR exchange_rate > 0);

ALTER TABLE supplier_bills
  DROP CONSTRAINT IF EXISTS chk_supplier_bills_exchange_rate_pos;
ALTER TABLE supplier_bills
  ADD CONSTRAINT chk_supplier_bills_exchange_rate_pos
  CHECK (exchange_rate IS NULL OR exchange_rate > 0);

ALTER TABLE supplier_payments
  DROP CONSTRAINT IF EXISTS chk_supplier_payments_exchange_rate_pos;
ALTER TABLE supplier_payments
  ADD CONSTRAINT chk_supplier_payments_exchange_rate_pos
  CHECK (exchange_rate IS NULL OR exchange_rate > 0);

ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS chk_stock_movements_exchange_rate_pos;
ALTER TABLE stock_movements
  ADD CONSTRAINT chk_stock_movements_exchange_rate_pos
  CHECK (exchange_rate IS NULL OR exchange_rate > 0);

ALTER TABLE inventory_layers
  DROP CONSTRAINT IF EXISTS chk_inventory_layers_exchange_rate_pos;
ALTER TABLE inventory_layers
  ADD CONSTRAINT chk_inventory_layers_exchange_rate_pos
  CHECK (exchange_rate IS NULL OR exchange_rate > 0);

ALTER TABLE supplier_payments
  DROP CONSTRAINT IF EXISTS chk_supplier_payments_amount_tendered_pos;
ALTER TABLE supplier_payments
  ADD CONSTRAINT chk_supplier_payments_amount_tendered_pos
  CHECK (amount_tendered IS NULL OR amount_tendered > 0);

ALTER TABLE goods_receipt_lines
  DROP CONSTRAINT IF EXISTS chk_goods_receipt_lines_unit_cost_base_nonneg;
ALTER TABLE goods_receipt_lines
  ADD CONSTRAINT chk_goods_receipt_lines_unit_cost_base_nonneg
  CHECK (unit_cost_base IS NULL OR unit_cost_base >= 0);

ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS chk_stock_movements_orig_unit_cost_nonneg;
ALTER TABLE stock_movements
  ADD CONSTRAINT chk_stock_movements_orig_unit_cost_nonneg
  CHECK (orig_unit_cost IS NULL OR orig_unit_cost >= 0);

ALTER TABLE inventory_layers
  DROP CONSTRAINT IF EXISTS chk_inventory_layers_orig_unit_cost_nonneg;
ALTER TABLE inventory_layers
  ADD CONSTRAINT chk_inventory_layers_orig_unit_cost_nonneg
  CHECK (orig_unit_cost IS NULL OR orig_unit_cost >= 0);

ALTER TABLE product_costs
  DROP CONSTRAINT IF EXISTS chk_product_costs_last_unit_cost_nonneg;
ALTER TABLE product_costs
  ADD CONSTRAINT chk_product_costs_last_unit_cost_nonneg
  CHECK (last_unit_cost IS NULL OR last_unit_cost >= 0);

ALTER TABLE product_costs
  DROP CONSTRAINT IF EXISTS chk_product_costs_last_unit_cost_base_nonneg;
ALTER TABLE product_costs
  ADD CONSTRAINT chk_product_costs_last_unit_cost_base_nonneg
  CHECK (last_unit_cost_base IS NULL OR last_unit_cost_base >= 0);

ALTER TABLE product_costs
  DROP CONSTRAINT IF EXISTS chk_product_costs_last_exchange_rate_pos;
ALTER TABLE product_costs
  ADD CONSTRAINT chk_product_costs_last_exchange_rate_pos
  CHECK (last_exchange_rate IS NULL OR last_exchange_rate > 0);
