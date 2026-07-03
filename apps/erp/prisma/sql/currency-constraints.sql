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
