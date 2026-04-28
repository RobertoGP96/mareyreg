-- =============================================
-- ENVIOS MODULE - Defensive DB constraints + dashboard materialized views
-- Apply manually after `pnpm db:push` (db push doesn't manage CHECK / EXCLUDE / matviews).
-- Run: psql "$DATABASE_URL" -f prisma/sql/envios-constraints.sql
-- =============================================

-- Required for EXCLUDE USING gist over numrange + scalar
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Defensa en profundidad: balances no negativos.
-- Nota: el flujo de aplicación permite ajustes (`adjustment`) que pueden dejar
-- balance temporal por debajo si se usa con flag explícito; el CHECK aquí evita
-- corrupción accidental por bugs. Si se necesita un override puntual, levantarlo
-- con SET CONSTRAINTS o una migración admin.
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_balance_nonneg,
  ADD  CONSTRAINT accounts_balance_nonneg CHECK (balance >= 0);

-- Rangos de tasa: invariantes elementales
ALTER TABLE exchange_rate_ranges
  DROP CONSTRAINT IF EXISTS err_min_nonneg,
  DROP CONSTRAINT IF EXISTS err_rate_pos,
  DROP CONSTRAINT IF EXISTS err_max_gt_min,
  ADD  CONSTRAINT err_min_nonneg CHECK (min_amount >= 0),
  ADD  CONSTRAINT err_rate_pos   CHECK (rate > 0),
  ADD  CONSTRAINT err_max_gt_min CHECK (max_amount IS NULL OR max_amount > min_amount);

-- Anti-solapamiento de rangos por regla
ALTER TABLE exchange_rate_ranges
  DROP CONSTRAINT IF EXISTS err_no_overlap;
ALTER TABLE exchange_rate_ranges
  ADD CONSTRAINT err_no_overlap
  EXCLUDE USING gist (
    exchange_rate_rule_id WITH =,
    numrange(min_amount, COALESCE(max_amount, 'infinity'::numeric), '[)') WITH &&
  );

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
