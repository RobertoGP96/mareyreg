-- =============================================
-- INVENTORY MODULE - Tipos de ubicacion (backfill)
-- Apply manually after `pnpm db:push`. Idempotente.
-- Run: psql "$DATABASE_URL" -f prisma/sql/inventory-locations.sql
--
-- location_type ya queda 'general' por el default del schema; aqui solo se
-- promueven a 'store' los almacenes que operan un punto de venta (tienen caja
-- registradora), que es la mejor senal disponible de "tienda".
-- =============================================

UPDATE warehouses
SET location_type = 'store'
WHERE warehouse_id IN (SELECT DISTINCT warehouse_id FROM cash_registers)
  AND location_type = 'general';
