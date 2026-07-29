-- =============================================
-- WEBSTORE MODULE - Índice parcial para la bandeja de órdenes que requieren atención
-- Apply manually after `pnpm db:push` (db push doesn't manage partial indexes).
-- Run: psql "$DATABASE_URL" -f prisma/sql/webstore-constraints.sql
-- =============================================

DROP INDEX IF EXISTS idx_webstore_logs_needs_attention;
CREATE INDEX idx_webstore_logs_needs_attention
  ON webstore_order_logs (received_at DESC)
  WHERE status IN ('needs_review', 'error');
