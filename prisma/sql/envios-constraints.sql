-- =============================================
-- ENVIOS MODULE - Defensive DB constraints + dashboard materialized views
-- Apply manually after `pnpm db:push` (db push doesn't manage CHECK / EXCLUDE / matviews).
-- Run: psql "$DATABASE_URL" -f prisma/sql/envios-constraints.sql
-- =============================================

-- Required for EXCLUDE USING gist over numrange + scalar
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Defensa en profundidad: balances no negativos por cuenta.
-- Nota: cuentas marcadas con `allow_negative_balance=true` pueden quedar en
-- rojo (típicamente representan deuda pendiente con un grupo). Las que no,
-- son protegidas por el CHECK. Adicionalmente operaciones type=adjustment
-- pueden bypass el guard de aplicación, pero siguen sujetas a este CHECK.
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_balance_nonneg,
  ADD  CONSTRAINT accounts_balance_nonneg CHECK (allow_negative_balance OR balance >= 0);

-- Reglas de tasa: invariantes elementales (ahora con rango inline en la propia regla)
ALTER TABLE exchange_rate_rules
  DROP CONSTRAINT IF EXISTS err_min_nonneg,
  DROP CONSTRAINT IF EXISTS err_rate_pos,
  DROP CONSTRAINT IF EXISTS err_max_gt_min,
  ADD  CONSTRAINT err_min_nonneg CHECK (min_amount >= 0),
  ADD  CONSTRAINT err_rate_pos   CHECK (rate > 0),
  ADD  CONSTRAINT err_max_gt_min CHECK (max_amount IS NULL OR max_amount > min_amount);

-- Anti-solapamiento de reglas asignadas a una misma cuenta para el mismo par.
-- No se puede expresar en EXCLUDE puro (requiere join con la pivot), por lo que se
-- valida vía función + triggers. La validación a nivel app es la primaria (mensajes ES);
-- esto es defensa en profundidad.
CREATE OR REPLACE FUNCTION assert_account_rates_no_overlap(p_account_id int)
RETURNS void AS $$
DECLARE
  conflict_record record;
BEGIN
  SELECT r1.id AS rule_a, r2.id AS rule_b,
         numrange(r1.min_amount, COALESCE(r1.max_amount, 'infinity'::numeric), '[)') AS range_a,
         numrange(r2.min_amount, COALESCE(r2.max_amount, 'infinity'::numeric), '[)') AS range_b
    INTO conflict_record
    FROM account_exchange_rate_rules p1
    JOIN exchange_rate_rules r1 ON r1.id = p1.rule_id AND r1.active
    JOIN account_exchange_rate_rules p2
      ON p2.account_id = p1.account_id AND p2.rule_id <> p1.rule_id
    JOIN exchange_rate_rules r2
      ON r2.id = p2.rule_id
     AND r2.active
     AND r2.base_currency_id = r1.base_currency_id
     AND r2.quote_currency_id = r1.quote_currency_id
   WHERE p1.account_id = p_account_id
     AND numrange(r1.min_amount, COALESCE(r1.max_amount, 'infinity'::numeric), '[)')
      && numrange(r2.min_amount, COALESCE(r2.max_amount, 'infinity'::numeric), '[)')
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'err_account_rates_overlap'
      USING DETAIL = format('account=%s rules=(%s,%s) ranges=(%s,%s)',
        p_account_id, conflict_record.rule_a, conflict_record.rule_b,
        conflict_record.range_a, conflict_record.range_b);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger sobre la pivot: al asignar una regla, validar no-solape con las ya asignadas.
CREATE OR REPLACE FUNCTION trg_account_rate_assign_check()
RETURNS trigger AS $$
BEGIN
  PERFORM assert_account_rates_no_overlap(NEW.account_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_account_exchange_rate_rules_overlap ON account_exchange_rate_rules;
CREATE CONSTRAINT TRIGGER trg_account_exchange_rate_rules_overlap
  AFTER INSERT OR UPDATE ON account_exchange_rate_rules
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION trg_account_rate_assign_check();

-- Trigger sobre la regla: si cambian min/max/par/active, revalidar todas las cuentas que la usan.
CREATE OR REPLACE FUNCTION trg_exchange_rate_rule_change_check()
RETURNS trigger AS $$
DECLARE
  acct_id int;
BEGIN
  FOR acct_id IN
    SELECT DISTINCT account_id FROM account_exchange_rate_rules WHERE rule_id = NEW.id
  LOOP
    PERFORM assert_account_rates_no_overlap(acct_id);
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_exchange_rate_rules_overlap ON exchange_rate_rules;
CREATE CONSTRAINT TRIGGER trg_exchange_rate_rules_overlap
  AFTER UPDATE OF min_amount, max_amount, base_currency_id, quote_currency_id, active
  ON exchange_rate_rules
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION trg_exchange_rate_rule_change_check();

-- Índice parcial para el feed de pendientes (consulta caliente)
DROP INDEX IF EXISTS operations_pending_idx;
CREATE INDEX operations_pending_idx
  ON operations (account_id, occurred_at)
  WHERE status = 'pending';

-- Materialized view: SALDO GENERAL por moneda (para los KPI cards del dashboard)
DROP MATERIALIZED VIEW IF EXISTS mv_balance_by_currency;
CREATE MATERIALIZED VIEW mv_balance_by_currency AS
  SELECT a.currency_id,
         c.code,
         c.symbol,
         c.decimal_places,
         SUM(a.balance)::numeric(20, 8) AS total,
         COUNT(*)::int                  AS account_count
  FROM accounts a
  JOIN currencies c ON c.id = a.currency_id
  WHERE a.active
  GROUP BY a.currency_id, c.code, c.symbol, c.decimal_places;

CREATE UNIQUE INDEX mv_balance_by_currency_pk
  ON mv_balance_by_currency (currency_id);

-- Materialized view: flujo mensual confirmed (chart inflow/outflow del dashboard)
DROP MATERIALIZED VIEW IF EXISTS mv_monthly_flow;
CREATE MATERIALIZED VIEW mv_monthly_flow AS
  SELECT date_trunc('month', occurred_at) AS month,
         currency_id,
         type,
         SUM(amount)::numeric(20, 8) AS total,
         COUNT(*)::int               AS n
  FROM operations
  WHERE status = 'confirmed'
  GROUP BY 1, 2, 3;

CREATE INDEX mv_monthly_flow_currency_month_idx
  ON mv_monthly_flow (currency_id, month DESC);

-- Las vistas se refrescan desde la app vía:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_balance_by_currency;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_flow;
-- ver src/modules/envios/lib/refresh-views.ts
