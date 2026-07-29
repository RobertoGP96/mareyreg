-- =============================================
-- ENVIOS - DDL de entregas multi-línea (FASE 2 de 3)
--
-- Generado por Prisma, NO escrito a mano:
--   prisma migrate diff --from-schema <schema-previo> --to-schema prisma/schema.prisma --script
--
-- Es el equivalente exacto de `prisma db push` para este cambio. Existe porque
-- el CLI de Prisma habla TCP:5432 y hay redes donde ese puerto está bloqueado;
-- el driver serverless de Neon (WebSocket/443) sí conecta. Si `pnpm db:push`
-- funciona en tu red, usa eso y IGNORA este archivo.
--
-- Aplicar entre -pre.sql y -post.sql:
--   node scripts/apply-sql.mjs prisma/sql/envios-delivery-lines-ddl.sql
--
-- NO es idempotente: correrlo dos veces falla en el primer CREATE TYPE.
-- =============================================

-- CreateEnum
CREATE TYPE "CurrencyKind" AS ENUM ('cash', 'digital');

-- CreateEnum
CREATE TYPE "DeliveryCommissionStatus" AS ENUM ('pending', 'paid');

-- DropForeignKey
ALTER TABLE "cash_deliveries" DROP CONSTRAINT "cash_deliveries_currency_id_fkey";

-- DropIndex
DROP INDEX "cash_deliveries_currency_id_idx";

-- AlterTable
ALTER TABLE "currencies" ADD COLUMN     "kind" "CurrencyKind" NOT NULL DEFAULT 'cash';

-- AlterTable
ALTER TABLE "cash_deliveries" DROP COLUMN "amount",
DROP COLUMN "currency_id",
ADD COLUMN     "commission_amount" DECIMAL(20,8) NOT NULL DEFAULT 0,
ADD COLUMN     "commission_currency_id" INTEGER,
ADD COLUMN     "commission_paid_at" TIMESTAMP(3),
ADD COLUMN     "commission_paid_by_id" INTEGER,
ADD COLUMN     "commission_status" "DeliveryCommissionStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "courier_id" INTEGER,
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "courier_profiles" (
    "courier_profile_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "default_commission" DECIMAL(20,8),
    "default_commission_currency_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courier_profiles_pkey" PRIMARY KEY ("courier_profile_id")
);

-- CreateTable
CREATE TABLE "currency_denominations" (
    "denomination_id" SERIAL NOT NULL,
    "currency_id" INTEGER NOT NULL,
    "value" DECIMAL(20,8) NOT NULL,
    "label" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currency_denominations_pkey" PRIMARY KEY ("denomination_id")
);

-- CreateTable
CREATE TABLE "cash_delivery_lines" (
    "line_id" SERIAL NOT NULL,
    "delivery_id" INTEGER NOT NULL,
    "currency_id" INTEGER NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_delivery_lines_pkey" PRIMARY KEY ("line_id")
);

-- CreateTable
CREATE TABLE "cash_delivery_line_denominations" (
    "line_denomination_id" SERIAL NOT NULL,
    "line_id" INTEGER NOT NULL,
    "denomination_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_value" DECIMAL(20,8) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_delivery_line_denominations_pkey" PRIMARY KEY ("line_denomination_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courier_profiles_user_id_key" ON "courier_profiles"("user_id");

-- CreateIndex
CREATE INDEX "courier_profiles_active_idx" ON "courier_profiles"("active");

-- CreateIndex
CREATE INDEX "currency_denominations_currency_id_active_sort_order_idx" ON "currency_denominations"("currency_id", "active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "currency_denominations_currency_id_value_key" ON "currency_denominations"("currency_id", "value");

-- CreateIndex
CREATE INDEX "cash_delivery_lines_currency_id_idx" ON "cash_delivery_lines"("currency_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_delivery_lines_delivery_id_currency_id_key" ON "cash_delivery_lines"("delivery_id", "currency_id");

-- CreateIndex
CREATE INDEX "cash_delivery_line_denominations_denomination_id_idx" ON "cash_delivery_line_denominations"("denomination_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_delivery_line_denominations_line_id_denomination_id_key" ON "cash_delivery_line_denominations"("line_id", "denomination_id");

-- CreateIndex
CREATE INDEX "cash_deliveries_courier_id_commission_status_idx" ON "cash_deliveries"("courier_id", "commission_status");

-- CreateIndex
CREATE INDEX "cash_deliveries_commission_status_occurred_at_idx" ON "cash_deliveries"("commission_status", "occurred_at");

-- AddForeignKey
ALTER TABLE "courier_profiles" ADD CONSTRAINT "courier_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_profiles" ADD CONSTRAINT "courier_profiles_default_commission_currency_id_fkey" FOREIGN KEY ("default_commission_currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_denominations" ADD CONSTRAINT "currency_denominations_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_deliveries" ADD CONSTRAINT "cash_deliveries_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "courier_profiles"("courier_profile_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_deliveries" ADD CONSTRAINT "cash_deliveries_commission_currency_id_fkey" FOREIGN KEY ("commission_currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_deliveries" ADD CONSTRAINT "cash_deliveries_commission_paid_by_id_fkey" FOREIGN KEY ("commission_paid_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_delivery_lines" ADD CONSTRAINT "cash_delivery_lines_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "cash_deliveries"("delivery_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_delivery_lines" ADD CONSTRAINT "cash_delivery_lines_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_delivery_line_denominations" ADD CONSTRAINT "cash_delivery_line_denominations_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "cash_delivery_lines"("line_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_delivery_line_denominations" ADD CONSTRAINT "cash_delivery_line_denominations_denomination_id_fkey" FOREIGN KEY ("denomination_id") REFERENCES "currency_denominations"("denomination_id") ON DELETE RESTRICT ON UPDATE CASCADE;
