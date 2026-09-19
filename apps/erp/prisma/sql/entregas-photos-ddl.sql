-- =============================================
-- ENTREGAS - DDL de la galería de fotos (equivalente a `prisma db push`)
--
-- Generado con Prisma y envuelto en guardas de idempotencia:
--   prisma migrate diff --from-schema <schema-previo> --to-schema prisma/schema.prisma --script
--
-- Existe porque el CLI de Prisma habla TCP:5432 y hay redes donde ese puerto
-- está bloqueado; el driver serverless de Neon (WebSocket/443) sí conecta.
-- Si `pnpm db:push` funciona en tu red, usa eso y IGNORA este archivo.
--
-- Orden:
--   node scripts/apply-sql.mjs prisma/sql/entregas-photos-ddl.sql   (este)
--   node scripts/apply-sql.mjs prisma/sql/entregas-constraints.sql
--   node scripts/apply-sql.mjs prisma/sql/entregas-photos.sql
--
-- Idempotente: se puede volver a correr sin efecto.
-- =============================================

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryPhotoKind') THEN
    CREATE TYPE "DeliveryPhotoKind" AS ENUM ('receipt', 'id_document', 'other');
  END IF;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "cash_delivery_photos" (
    "photo_id" SERIAL NOT NULL,
    "delivery_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "DeliveryPhotoKind" NOT NULL DEFAULT 'receipt',
    "caption" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_delivery_photos_pkey" PRIMARY KEY ("photo_id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cash_delivery_photos_delivery_id_sort_order_idx"
  ON "cash_delivery_photos"("delivery_id", "sort_order");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_delivery_photos_delivery_id_fkey'
  ) THEN
    ALTER TABLE "cash_delivery_photos"
      ADD CONSTRAINT "cash_delivery_photos_delivery_id_fkey"
      FOREIGN KEY ("delivery_id") REFERENCES "cash_deliveries"("delivery_id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_delivery_photos_uploaded_by_id_fkey'
  ) THEN
    ALTER TABLE "cash_delivery_photos"
      ADD CONSTRAINT "cash_delivery_photos_uploaded_by_id_fkey"
      FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("user_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
