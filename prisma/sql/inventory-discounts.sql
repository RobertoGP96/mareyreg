-- `db push` no aplica índices parciales; ejecutar manualmente con `psql`
-- (o el cliente SQL de Neon) después de correr `pnpm prisma db push`.

-- Regla de negocio: máximo un descuento activo por producto.
CREATE UNIQUE INDEX IF NOT EXISTS discount_one_active_per_product
  ON discounts (product_id)
  WHERE is_active = true AND product_id IS NOT NULL;
