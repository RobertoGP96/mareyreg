-- =============================================
-- ENVIOS - Pre-migración a entregas multi-línea (FASE 1 de 3)
--
-- Respalda cash_deliveries.amount / currency_id ANTES de que `db push` las
-- elimine. No cambia la estructura de ninguna tabla viva. Idempotente.
--
-- Secuencia completa:
--   1) psql "$DATABASE_URL" -f prisma/sql/envios-delivery-lines-pre.sql
--   2) pnpm db:generate && pnpm db:push
--      (avisará de pérdida de datos en amount/currency_id — ESPERADO,
--       ya quedaron respaldados en el paso 1)
--   3) psql "$DATABASE_URL" -f prisma/sql/envios-delivery-lines-post.sql
--   4) psql "$DATABASE_URL" -f prisma/sql/envios-cash-delivery.sql
--
-- Pre-requisito: pg_dump de cash_deliveries + audit_log, y ensayar la
-- secuencia completa en una rama de Neon (`neon branches create migration-test`)
-- antes de tocar producción.
-- =============================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name   = 'cash_deliveries'
       AND column_name  = 'amount'
  ) THEN
    RAISE NOTICE 'cash_deliveries.amount ya no existe: respaldo omitido.';
  ELSE
    CREATE TABLE IF NOT EXISTS _cash_delivery_legacy_amounts (
      delivery_id integer       PRIMARY KEY,
      currency_id integer       NOT NULL,
      amount      numeric(20,8) NOT NULL,
      captured_at timestamptz   NOT NULL DEFAULT now()
    );

    -- SQL dinámico a propósito: el INSERT referencia columnas que pueden no
    -- existir, y Postgres valida el cuerpo estático del bloque al parsearlo.
    EXECUTE $sql$
      INSERT INTO _cash_delivery_legacy_amounts (delivery_id, currency_id, amount)
      SELECT delivery_id, currency_id, amount
        FROM cash_deliveries
      ON CONFLICT (delivery_id) DO NOTHING
    $sql$;

    RAISE NOTICE 'Respaldadas % entregas legacy.',
      (SELECT COUNT(*) FROM _cash_delivery_legacy_amounts);
  END IF;
END $$;

COMMIT;
