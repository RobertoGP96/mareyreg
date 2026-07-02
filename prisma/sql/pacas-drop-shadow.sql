-- Limpieza del espejo contable de pacas (productos sombra).
-- Aplicar manualmente con psql DESPUES de `pnpm prisma db push`
-- (el push elimina la columna paca_categories.product_id y su FK,
-- liberando el Restrict que bloqueaba borrar los productos sombra).
--
-- Verificacion previa: los productos sombra no deben tener referencias
-- de ventas/compras reales. Si alguno de estos SELECT devuelve filas,
-- ABORTAR y revisar manualmente antes de continuar:
--
--   SELECT * FROM invoice_lines
--     WHERE product_id IN (SELECT product_id FROM products WHERE sku LIKE 'PACA-%' AND category = 'Pacas');
--   SELECT * FROM sales_order_lines
--     WHERE product_id IN (SELECT product_id FROM products WHERE sku LIKE 'PACA-%' AND category = 'Pacas');
--   SELECT * FROM purchase_order_lines
--     WHERE product_id IN (SELECT product_id FROM products WHERE sku LIKE 'PACA-%' AND category = 'Pacas');
--   SELECT * FROM stock_reservations
--     WHERE product_id IN (SELECT product_id FROM products WHERE sku LIKE 'PACA-%' AND category = 'Pacas');

BEGIN;

DELETE FROM stock_movements
  WHERE product_id IN (SELECT product_id FROM products WHERE sku LIKE 'PACA-%' AND category = 'Pacas');

DELETE FROM stock_levels
  WHERE product_id IN (SELECT product_id FROM products WHERE sku LIKE 'PACA-%' AND category = 'Pacas');

-- Defensivo: no deberian existir para productos sombra.
DELETE FROM inventory_layers
  WHERE product_id IN (SELECT product_id FROM products WHERE sku LIKE 'PACA-%' AND category = 'Pacas');

DELETE FROM product_valuations
  WHERE product_id IN (SELECT product_id FROM products WHERE sku LIKE 'PACA-%' AND category = 'Pacas');

DELETE FROM products
  WHERE sku LIKE 'PACA-%' AND category = 'Pacas';

DELETE FROM warehouses
  WHERE name = 'Pacas' AND warehouse_type = 'pacas';

COMMIT;
