-- =============================================
-- ENTREGAS - Proveedores (DDL equivalente a `prisma db push` + CHECK)
--
-- El DDL existe por la misma razón que entregas-photos-ddl.sql: redes donde
-- el puerto 5432 del CLI de Prisma está bloqueado. Si `pnpm db:push` funciona,
-- solo el CHECK del final aporta algo (db push no lo crea).
--
-- Idempotente: se puede volver a correr sin efecto.
-- =============================================

-- CreateTable
CREATE TABLE IF NOT EXISTS "delivery_providers" (
    "provider_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_providers_pkey" PRIMARY KEY ("provider_id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "delivery_providers_active_name_idx"
  ON "delivery_providers"("active", "name");

-- AlterTable
ALTER TABLE "cash_deliveries" ADD COLUMN IF NOT EXISTS "provider_id" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cash_deliveries_provider_id_idx"
  ON "cash_deliveries"("provider_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_deliveries_provider_id_fkey'
  ) THEN
    ALTER TABLE "cash_deliveries"
      ADD CONSTRAINT "cash_deliveries_provider_id_fkey"
      FOREIGN KEY ("provider_id") REFERENCES "delivery_providers"("provider_id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- Un proveedor sin nombre no identifica nada.
ALTER TABLE "delivery_providers"
  DROP CONSTRAINT IF EXISTS "chk_delivery_provider_name_not_blank";
ALTER TABLE "delivery_providers"
  ADD CONSTRAINT "chk_delivery_provider_name_not_blank"
  CHECK (length(btrim("name")) > 0);
