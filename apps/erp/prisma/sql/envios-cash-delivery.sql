-- Constraints for cash deliveries module (envios)
-- Apply manually with psql after `prisma db push`. `db push` does not handle CHECK.

ALTER TABLE cash_deliveries
  DROP CONSTRAINT IF EXISTS cash_deliveries_amount_positive,
  ADD  CONSTRAINT cash_deliveries_amount_positive CHECK (amount > 0);

ALTER TABLE cash_deliveries
  DROP CONSTRAINT IF EXISTS cash_deliveries_delivered_at_required,
  ADD  CONSTRAINT cash_deliveries_delivered_at_required
       CHECK (status <> 'delivered' OR delivered_at IS NOT NULL);

ALTER TABLE cash_deliveries
  DROP CONSTRAINT IF EXISTS cash_deliveries_cancelled_at_required,
  ADD  CONSTRAINT cash_deliveries_cancelled_at_required
       CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL);
