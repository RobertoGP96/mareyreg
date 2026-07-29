-- =============================================
-- ENVIOS - Post-migración a entregas multi-línea (FASE 3 de 3)
--
-- Convierte cada entrega legacy en una única línea con su monto y moneda
-- originales, deja traza en audit_log y verifica que ninguna entrega quede
-- sin líneas. Idempotente: re-ejecutable sin duplicar nada.
--
-- Correr DESPUÉS de `pnpm db:push`. Ver la secuencia completa en
-- prisma/sql/envios-delivery-lines-pre.sql.
-- =============================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('_cash_delivery_legacy_amounts') IS NULL THEN
    RAISE NOTICE 'Sin tabla de respaldo: migración ya completada y limpiada.';
    RETURN;
  END IF;

  INSERT INTO cash_delivery_lines (delivery_id, currency_id, amount, sort_order, created_at, updated_at)
  SELECT l.delivery_id, l.currency_id, l.amount, 0, now(), now()
    FROM _cash_delivery_legacy_amounts l
    JOIN cash_deliveries d ON d.delivery_id = l.delivery_id
   WHERE NOT EXISTS (
     SELECT 1 FROM cash_delivery_lines cdl WHERE cdl.delivery_id = l.delivery_id
   );

  INSERT INTO audit_log (action, entity_type, entity_id, module, user_id, new_values, created_at)
  SELECT 'migrated_to_lines', 'CashDelivery', l.delivery_id, 'envios', NULL,
         jsonb_build_object('legacyCurrencyId', l.currency_id, 'legacyAmount', l.amount),
         now()
    FROM _cash_delivery_legacy_amounts l
   WHERE NOT EXISTS (
     SELECT 1 FROM audit_log a
      WHERE a.entity_type = 'CashDelivery'
        AND a.entity_id   = l.delivery_id
        AND a.action      = 'migrated_to_lines'
   );
END $$;

-- Ninguna entrega puede quedarse sin líneas: aborta la migración si pasa.
DO $$
DECLARE orphans int;
BEGIN
  SELECT COUNT(*) INTO orphans
    FROM cash_deliveries d
   WHERE NOT EXISTS (
     SELECT 1 FROM cash_delivery_lines l WHERE l.delivery_id = d.delivery_id
   );
  IF orphans > 0 THEN
    RAISE EXCEPTION 'Entregas sin líneas después del backfill: %', orphans;
  END IF;
END $$;

COMMIT;

-- Verificado el backfill en producción, limpiar el respaldo A MANO:
--   DROP TABLE _cash_delivery_legacy_amounts;
