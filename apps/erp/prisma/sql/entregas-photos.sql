-- =============================================
-- ENTREGAS - Galería de fotos (cash_delivery_photos)
--
-- Aplicar manualmente tras `prisma db push`. Idempotente.
--   psql "$DATABASE_URL" -f prisma/sql/entregas-photos.sql
--   (o: node scripts/apply-sql.mjs prisma/sql/entregas-photos.sql)
-- =============================================

ALTER TABLE cash_delivery_photos
  DROP CONSTRAINT IF EXISTS chk_delivery_photo_url_nonempty,
  ADD  CONSTRAINT chk_delivery_photo_url_nonempty
       CHECK (length(btrim(url)) > 0);

ALTER TABLE cash_delivery_photos
  DROP CONSTRAINT IF EXISTS chk_delivery_photo_sort_nonneg,
  ADD  CONSTRAINT chk_delivery_photo_sort_nonneg
       CHECK (sort_order >= 0);

-- Backfill: la foto única del modelo anterior (cash_deliveries.photo_url) pasa
-- a ser la primera foto de la galería. La columna se conserva como respaldo;
-- el código ya no la escribe. Re-ejecutar no duplica.
INSERT INTO cash_delivery_photos (delivery_id, url, kind, caption, sort_order, uploaded_by_id, created_at)
SELECT d.delivery_id,
       btrim(d.photo_url),
       'receipt'::"DeliveryPhotoKind",
       NULL,
       0,
       COALESCE(d.confirmed_by_id, d.created_by_id),
       d.updated_at
  FROM cash_deliveries d
 WHERE d.photo_url IS NOT NULL
   AND btrim(d.photo_url) <> ''
   AND NOT EXISTS (
         SELECT 1 FROM cash_delivery_photos p
          WHERE p.delivery_id = d.delivery_id
            AND p.url = btrim(d.photo_url)
       );
