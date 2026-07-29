-- `db push` no aplica índices parciales ni backfills; ejecutar manualmente con
-- `psql` (o el cliente SQL de Neon) después de correr `pnpm prisma db push`.

-- Backfill: clientes creados por pedidos de la tienda en línea.
UPDATE customers SET source = 'webstore'
WHERE source = 'internal'
  AND customer_id IN (
    SELECT DISTINCT customer_id FROM sales_orders WHERE channel = 'online'
  );

-- Backfill: teléfono normalizado (solo dígitos) para todos los clientes.
UPDATE customers
SET normalized_phone = NULLIF(regexp_replace(phone, '\D', '', 'g'), '')
WHERE phone IS NOT NULL AND normalized_phone IS NULL;

-- ANTES de crear el índice único, detectar duplicados que lo harían fallar
-- (resolver a mano: desactivar o corregir el teléfono del duplicado):
--   SELECT normalized_phone, count(*), array_agg(customer_id)
--   FROM customers
--   WHERE source = 'webstore' AND normalized_phone IS NOT NULL
--   GROUP BY 1 HAVING count(*) > 1;

-- Regla de negocio: el teléfono normalizado identifica de forma única a un
-- cliente de la tienda (clave de matching del upsert de registro).
CREATE UNIQUE INDEX IF NOT EXISTS customers_webstore_phone_unique
  ON customers (normalized_phone)
  WHERE source = 'webstore' AND normalized_phone IS NOT NULL;
