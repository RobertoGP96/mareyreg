-- =============================================
-- CURRENCY MODULE - Backfill de monedas base (CUP/USD) y tasa inicial
-- Apply manually after `pnpm db:push` (idempotente, se puede correr varias veces).
--
-- Uso (requiere la variable psql `rate_inicial`, ej. 1 USD = 380 CUP):
--   psql "$DATABASE_URL" -v rate_inicial=380 -f prisma/sql/currency-backfill.sql
-- =============================================

-- 1. Monedas base del negocio (CUP moneda operativa/tienda, USD moneda de compra).
INSERT INTO currencies (code, name, symbol, decimal_places, active, created_at, updated_at)
VALUES ('CUP', 'Peso cubano', '$', 0, true, now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO currencies (code, name, symbol, decimal_places, active, created_at, updated_at)
VALUES ('USD', 'Dólar estadounidense', '$', 2, true, now(), now())
ON CONFLICT (code) DO NOTHING;

-- Si CUP ya existía (módulo envios) puede traer otros decimales; el negocio
-- maneja pesos enteros, así que se fuerza 0 aunque el INSERT no haya aplicado.
UPDATE currencies
   SET decimal_places = 0, updated_at = now()
 WHERE code = 'CUP' AND decimal_places <> 0;

-- 2. La empresa (singleton id=1) opera en CUP y esa es ahora la moneda base de referencia.
UPDATE company
   SET currency = 'CUP',
       base_currency_id = (SELECT id FROM currencies WHERE code = 'CUP'),
       updated_at = now()
 WHERE id = 1;

-- 3. Tasa inicial USD -> CUP (1 USD = :rate_inicial CUP) + primera fila de historial.
--    Solo se inserta si el par no existe todavía (idempotente).
DO $$
DECLARE
  usd_id integer;
  cup_id integer;
  new_rate_id integer;
  initial_rate numeric(20, 8) := :'rate_inicial';
BEGIN
  SELECT id INTO usd_id FROM currencies WHERE code = 'USD';
  SELECT id INTO cup_id FROM currencies WHERE code = 'CUP';

  IF usd_id IS NULL OR cup_id IS NULL THEN
    RAISE EXCEPTION 'No se encontraron las monedas USD/CUP. Revisa el paso 1.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM exchange_rates
     WHERE base_currency_id = usd_id AND quote_currency_id = cup_id
  ) THEN
    INSERT INTO exchange_rates
      (base_currency_id, quote_currency_id, rate, version, updated_by, created_at, updated_at)
    VALUES
      (usd_id, cup_id, initial_rate, 0, NULL, now(), now())
    RETURNING id INTO new_rate_id;

    INSERT INTO exchange_rate_history
      (exchange_rate_id, old_rate, new_rate, changed_by, changed_at, note)
    VALUES
      (new_rate_id, NULL, initial_rate, NULL, now(), 'Tasa inicial via backfill');
  ELSE
    RAISE NOTICE 'El par USD->CUP ya existe en exchange_rates. Saliendo sin cambios.';
  END IF;
END $$;
