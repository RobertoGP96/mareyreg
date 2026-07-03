-- `db push` no aplica CHECK constraints; ejecutar manualmente con `psql`
-- (o el cliente SQL de Neon) después de correr `pnpm prisma db push`.

-- Reglas de negocio de ofertas de la tienda: valor positivo, percent acotado a 100,
-- volume no aplica a ofertas y las fechas deben estar ordenadas.
ALTER TABLE webstore_offers DROP CONSTRAINT IF EXISTS webstore_offers_value_positive;
ALTER TABLE webstore_offers ADD CONSTRAINT webstore_offers_value_positive
  CHECK (value > 0);

ALTER TABLE webstore_offers DROP CONSTRAINT IF EXISTS webstore_offers_percent_max;
ALTER TABLE webstore_offers ADD CONSTRAINT webstore_offers_percent_max
  CHECK (type <> 'percent' OR value <= 100);

ALTER TABLE webstore_offers DROP CONSTRAINT IF EXISTS webstore_offers_no_volume;
ALTER TABLE webstore_offers ADD CONSTRAINT webstore_offers_no_volume
  CHECK (type <> 'volume');

ALTER TABLE webstore_offers DROP CONSTRAINT IF EXISTS webstore_offers_dates_order;
ALTER TABLE webstore_offers ADD CONSTRAINT webstore_offers_dates_order
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);
