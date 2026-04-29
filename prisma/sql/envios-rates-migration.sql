-- =============================================
-- ENVIOS MODULE - Migración one-shot a reglas de tasa N:M con rango inline
-- =============================================
-- Cambia el modelo:
--   ANTES: Account (1) → ExchangeRateRule (1) → ExchangeRateRange (N rangos por regla)
--   DESPUÉS: Account (N) ↔ ExchangeRateRule (M, cada una con 1 rango inline) vía pivot
--            account_exchange_rate_rules
--
-- Cada `exchange_rate_ranges` original se convierte en una `exchange_rate_rules` nueva
-- (regla "hoja"). Las cuentas que apuntaban a la regla original quedan asignadas en la
-- pivot a TODAS las reglas derivadas. Las operaciones se re-mapean a la regla cuyo
-- rango contiene el monto registrado.
--
-- IMPORTANTE — pre-requisitos:
--   1. Hacer pg_dump previo de exchange_rate_*, accounts, operations, audit_logs.
--   2. Probar primero en una rama de Neon (`neon branches create migration-test`).
--   3. NO ejecutar `pnpm db:push` antes; este script lleva la DB al estado del nuevo schema.
--   4. Después de aplicar este script, ejecutar `pnpm db:push` (debe ser casi no-op) y
--      `psql -f prisma/sql/envios-constraints.sql` para añadir triggers anti-solape.
--
-- Ejecución:
--   psql "$DATABASE_URL" -f prisma/sql/envios-rates-migration.sql
-- =============================================

BEGIN;

-- 0. Idempotencia: si ya está migrado, abortar limpio.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'exchange_rate_ranges'
  ) THEN
    RAISE NOTICE 'Migración ya aplicada (no existe exchange_rate_ranges). Saliendo.';
    RETURN;
  END IF;
END $$;

-- 1. Añadir columnas nuevas a exchange_rate_rules (nullable temporalmente para poder
--    convivir con las reglas viejas durante la migración).
ALTER TABLE exchange_rate_rules
  ADD COLUMN IF NOT EXISTS min_amount numeric(20, 8),
  ADD COLUMN IF NOT EXISTS max_amount numeric(20, 8),
  ADD COLUMN IF NOT EXISTS rate       numeric(20, 8),
  ADD COLUMN IF NOT EXISTS version    integer NOT NULL DEFAULT 0;

-- 2. Crear la tabla pivot (sin triggers todavía: los aplica envios-constraints.sql).
CREATE TABLE IF NOT EXISTS account_exchange_rate_rules (
  account_id integer     NOT NULL REFERENCES accounts(id)             ON DELETE RESTRICT,
  rule_id    integer     NOT NULL REFERENCES exchange_rate_rules(id)  ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, rule_id)
);
CREATE INDEX IF NOT EXISTS account_exchange_rate_rules_rule_id_idx
  ON account_exchange_rate_rules(rule_id);
CREATE INDEX IF NOT EXISTS account_exchange_rate_rules_account_id_idx
  ON account_exchange_rate_rules(account_id);

-- 3. Tabla temporal de mapeo old_rule → new_rules (una fila por rango original).
CREATE TEMP TABLE _rule_split (
  old_rule_id integer       NOT NULL,
  range_id    integer       NOT NULL,
  new_rule_id integer       NOT NULL,
  min_amount  numeric(20,8) NOT NULL,
  max_amount  numeric(20,8),
  rate        numeric(20,8) NOT NULL
) ON COMMIT DROP;

-- 4. Por cada exchange_rate_ranges existente: insertar una nueva regla "hoja"
--    y registrar el mapeo en _rule_split.
DO $$
DECLARE
  rng_rec   record;
  new_id    integer;
  new_name  text;
BEGIN
  FOR rng_rec IN
    SELECT  rng.id                                  AS range_id,
            rng.exchange_rate_rule_id               AS old_rule_id,
            rng.min_amount,
            rng.max_amount,
            rng.rate,
            orig.name                               AS orig_name,
            orig.base_currency_id,
            orig.quote_currency_id,
            orig.active                             AS orig_active,
            rng.created_at,
            rng.updated_at
      FROM exchange_rate_ranges rng
      JOIN exchange_rate_rules  orig ON orig.id = rng.exchange_rate_rule_id
      ORDER BY rng.exchange_rate_rule_id, rng.min_amount
  LOOP
    new_name := rng_rec.orig_name
              || ' [' || rng_rec.min_amount::text
              || '–'  || COALESCE(rng_rec.max_amount::text, '∞')
              || '] #'|| rng_rec.range_id::text;

    INSERT INTO exchange_rate_rules
      (name, base_currency_id, quote_currency_id,
       min_amount, max_amount, rate,
       active, version, created_at, updated_at)
    VALUES
      (new_name, rng_rec.base_currency_id, rng_rec.quote_currency_id,
       rng_rec.min_amount, rng_rec.max_amount, rng_rec.rate,
       rng_rec.orig_active, 0, rng_rec.created_at, rng_rec.updated_at)
    RETURNING id INTO new_id;

    INSERT INTO _rule_split (old_rule_id, range_id, new_rule_id, min_amount, max_amount, rate)
    VALUES (rng_rec.old_rule_id, rng_rec.range_id, new_id,
            rng_rec.min_amount, rng_rec.max_amount, rng_rec.rate);
  END LOOP;
END $$;

-- 5. Poblar pivot: cada cuenta que apuntaba a una regla vieja queda asignada a TODAS
--    las nuevas reglas derivadas de esa regla original.
INSERT INTO account_exchange_rate_rules (account_id, rule_id, created_at)
SELECT a.id, s.new_rule_id, now()
  FROM accounts a
  JOIN _rule_split s ON s.old_rule_id = a.exchange_rate_rule_id
 WHERE a.exchange_rate_rule_id IS NOT NULL
ON CONFLICT (account_id, rule_id) DO NOTHING;

-- 6. Re-mapear operations.exchange_rate_rule_id apuntando a la nueva regla "hoja"
--    cuyo [min, max) contiene el rateApplied (proxy del monto convertido). Si no
--    se encuentra match, se cae al primer derivado de la misma regla original.
WITH best_match AS (
  SELECT op.id                AS operation_id,
         (
           SELECT s.new_rule_id
             FROM _rule_split s
            WHERE s.old_rule_id = op.exchange_rate_rule_id
              AND op.amount >= s.min_amount
              AND (s.max_amount IS NULL OR op.amount < s.max_amount)
            ORDER BY s.min_amount
            LIMIT 1
         ) AS matched_rule_id,
         (
           SELECT s.new_rule_id
             FROM _rule_split s
            WHERE s.old_rule_id = op.exchange_rate_rule_id
            ORDER BY s.min_amount
            LIMIT 1
         ) AS fallback_rule_id
    FROM operations op
   WHERE op.exchange_rate_rule_id IS NOT NULL
)
UPDATE operations op
   SET exchange_rate_rule_id = COALESCE(bm.matched_rule_id, bm.fallback_rule_id)
  FROM best_match bm
 WHERE bm.operation_id = op.id
   AND COALESCE(bm.matched_rule_id, bm.fallback_rule_id) IS NOT NULL;

-- 7. Auditar las operaciones que se cayeron al fallback (rateApplied fuera de todo rango).
INSERT INTO audit_logs (action, entity_type, entity_id, module, user_id, new_values, created_at)
SELECT 'rate_remapped_fallback',
       'Operation',
       op.id,
       'envios',
       NULL,
       jsonb_build_object(
         'amount', op.amount,
         'reason', 'No hay rango derivado que contenga el amount; usando primer derivado.'
       ),
       now()
  FROM operations op
  JOIN _rule_split s ON s.new_rule_id = op.exchange_rate_rule_id
  -- caso fallback: el rule asignado no contiene el amount
 WHERE NOT (op.amount >= s.min_amount
            AND (s.max_amount IS NULL OR op.amount < s.max_amount));

-- 8. Eliminar reglas viejas (las que tenían ranges; ahora todas las operaciones y cuentas
--    apuntan a las nuevas reglas hoja).
DELETE FROM exchange_rate_rules
 WHERE id IN (SELECT DISTINCT old_rule_id FROM _rule_split);

-- 9. Drop tabla de rangos y columna 1:1 obsoleta.
DROP TABLE IF EXISTS exchange_rate_ranges CASCADE;
ALTER TABLE accounts DROP COLUMN IF EXISTS exchange_rate_rule_id;

-- 10. Eliminar enum kind si ya no lo usa ninguna columna (Prisma lo dropeará en db:push,
--     pero lo hacemos explícito por claridad).
ALTER TABLE exchange_rate_rules DROP COLUMN IF EXISTS kind;
DROP TYPE IF EXISTS "RateKind";

-- 11. Promover columnas nuevas a NOT NULL (ya pobladas).
ALTER TABLE exchange_rate_rules
  ALTER COLUMN min_amount SET NOT NULL,
  ALTER COLUMN rate       SET NOT NULL;

-- 12. Sanity check: ninguna regla queda sin rango definido.
DO $$
DECLARE
  orphans int;
BEGIN
  SELECT COUNT(*) INTO orphans
    FROM exchange_rate_rules
   WHERE min_amount IS NULL OR rate IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION 'Reglas sin rango/tasa después de migrar: %', orphans;
  END IF;
END $$;

-- 13. Refrescar matviews dependientes (no necesario, pero conveniente).
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_balance_by_currency;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_flow;

COMMIT;

-- Después de este script:
--   1. `pnpm prisma generate` para regenerar el cliente.
--   2. `pnpm db:push` (no-op esperado; verifica alineación con el nuevo schema).
--   3. `psql "$DATABASE_URL" -f prisma/sql/envios-constraints.sql` (triggers anti-solape).
