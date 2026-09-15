-- =============================================
-- WEBSTORE MODULE - Grupos de modelos (CHECKs + índice único parcial)
-- `db push` NO aplica CHECK ni índices parciales. Aplicar manualmente ANTES de
-- desplegar el ERP que escribe membresías:
--   psql "$DATABASE_URL" -f prisma/sql/webstore-model-groups.sql
--   (o, sin psql, desde apps/erp: node scripts/apply-sql.mjs prisma/sql/webstore-model-groups.sql)
-- Idempotente: ejecutarlo dos veces debe ser no-op.
--
-- Invariantes:
--   * Un producto agrupado SIEMPRE tiene etiqueta de modelo no vacía, y un
--     producto sin grupo nunca tiene etiqueta.
--   * Dos modelos del mismo grupo no comparten etiqueta (sin distinguir
--     mayúsculas ni espacios en los extremos).
--
-- Pre-chequeo (debe devolver 0 filas; si no, corregir antes de crear el índice):
--   SELECT model_group_id, lower(btrim(model_label)), count(*)
--   FROM products WHERE model_group_id IS NOT NULL
--   GROUP BY 1, 2 HAVING count(*) > 1;
-- =============================================

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_model_label_with_group;
ALTER TABLE products ADD CONSTRAINT products_model_label_with_group
  CHECK (
    (model_group_id IS NULL) = (model_label IS NULL)
    AND (model_label IS NULL OR btrim(model_label) <> '')
  );

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_model_sort_order_nonneg;
ALTER TABLE products ADD CONSTRAINT products_model_sort_order_nonneg
  CHECK (model_sort_order >= 0);

ALTER TABLE webstore_model_groups DROP CONSTRAINT IF EXISTS webstore_model_groups_nonblank;
ALTER TABLE webstore_model_groups ADD CONSTRAINT webstore_model_groups_nonblank
  CHECK (btrim(name) <> '' AND btrim(option_label) <> '');

CREATE UNIQUE INDEX IF NOT EXISTS products_model_group_label_uq
  ON products (model_group_id, lower(btrim(model_label)))
  WHERE model_group_id IS NOT NULL;

-- Verificación (debe devolver 1 fila):
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'products' AND indexname = 'products_model_group_label_uq';

-- Auditoría (solo lectura): grupos con menos de 2 miembros publicables en la
-- tienda. No es un error (la card sale sin selector), pero suele indicar un
-- modelo aún no habilitado o sin SKU.
--   SELECT g.group_id, g.name,
--          COUNT(p.product_id) AS modelos,
--          COUNT(p.product_id) FILTER (WHERE p.webstore_enabled AND p.is_active AND p.sku IS NOT NULL) AS publicables
--   FROM webstore_model_groups g
--   LEFT JOIN products p ON p.model_group_id = g.group_id
--   GROUP BY g.group_id, g.name
--   HAVING COUNT(p.product_id) FILTER (WHERE p.webstore_enabled AND p.is_active AND p.sku IS NOT NULL) < 2
--   ORDER BY g.name;
