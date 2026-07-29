-- =============================================
-- ENVIOS - Constraints de entregas de efectivo
-- (multi-línea + desglose por denominaciones + comisión del mensajero)
--
-- Aplicar manualmente tras `prisma db push`. `db push` no maneja CHECK,
-- funciones ni triggers. Idempotente.
--   psql "$DATABASE_URL" -f prisma/sql/envios-cash-delivery.sql
-- =============================================

-- ---------------------------------------------
-- cash_deliveries
-- ---------------------------------------------

-- La columna amount desapareció al migrar a líneas; su CHECK vive ahora en
-- cash_delivery_lines. Postgres ya lo tira junto con la columna, pero lo
-- dejamos explícito para que este script sea auto-suficiente.
ALTER TABLE cash_deliveries
  DROP CONSTRAINT IF EXISTS cash_deliveries_amount_positive;

ALTER TABLE cash_deliveries
  DROP CONSTRAINT IF EXISTS cash_deliveries_delivered_at_required,
  ADD  CONSTRAINT cash_deliveries_delivered_at_required
       CHECK (status <> 'delivered' OR delivered_at IS NOT NULL);

ALTER TABLE cash_deliveries
  DROP CONSTRAINT IF EXISTS cash_deliveries_cancelled_at_required,
  ADD  CONSTRAINT cash_deliveries_cancelled_at_required
       CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL);

ALTER TABLE cash_deliveries
  DROP CONSTRAINT IF EXISTS chk_delivery_commission_nonneg,
  ADD  CONSTRAINT chk_delivery_commission_nonneg
       CHECK (commission_amount >= 0);

ALTER TABLE cash_deliveries
  DROP CONSTRAINT IF EXISTS chk_delivery_commission_paid_at,
  ADD  CONSTRAINT chk_delivery_commission_paid_at
       CHECK (commission_status <> 'paid' OR commission_paid_at IS NOT NULL);

-- Una comisión con monto necesita moneda y dueño.
ALTER TABLE cash_deliveries
  DROP CONSTRAINT IF EXISTS chk_delivery_commission_currency,
  ADD  CONSTRAINT chk_delivery_commission_currency
       CHECK (commission_amount = 0 OR commission_currency_id IS NOT NULL);

ALTER TABLE cash_deliveries
  DROP CONSTRAINT IF EXISTS chk_delivery_commission_needs_courier,
  ADD  CONSTRAINT chk_delivery_commission_needs_courier
       CHECK (commission_amount = 0 OR courier_id IS NOT NULL);

-- ---------------------------------------------
-- courier_profiles
-- ---------------------------------------------

ALTER TABLE courier_profiles
  DROP CONSTRAINT IF EXISTS chk_courier_default_commission_nonneg,
  ADD  CONSTRAINT chk_courier_default_commission_nonneg
       CHECK (default_commission IS NULL OR default_commission >= 0);

ALTER TABLE courier_profiles
  DROP CONSTRAINT IF EXISTS chk_courier_default_commission_currency,
  ADD  CONSTRAINT chk_courier_default_commission_currency
       CHECK (COALESCE(default_commission, 0) = 0 OR default_commission_currency_id IS NOT NULL);

-- ---------------------------------------------
-- currency_denominations
-- ---------------------------------------------

ALTER TABLE currency_denominations
  DROP CONSTRAINT IF EXISTS chk_denomination_value_pos,
  ADD  CONSTRAINT chk_denomination_value_pos CHECK (value > 0);

-- Una moneda digital (USDT, saldos) no se desglosa en billetes. Cruza tablas,
-- así que no puede ser un CHECK.
CREATE OR REPLACE FUNCTION trg_denomination_currency_kind_check()
RETURNS trigger AS $$
DECLARE
  v_kind text;
BEGIN
  SELECT kind::text INTO v_kind FROM currencies WHERE id = NEW.currency_id;
  IF v_kind = 'digital' THEN
    RAISE EXCEPTION 'err_denomination_digital_currency'
      USING DETAIL = format('currency=%s', NEW.currency_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cd_denomination_kind ON currency_denominations;
CREATE TRIGGER trg_cd_denomination_kind
  BEFORE INSERT OR UPDATE ON currency_denominations
  FOR EACH ROW EXECUTE FUNCTION trg_denomination_currency_kind_check();

-- ---------------------------------------------
-- cash_delivery_lines
-- ---------------------------------------------

ALTER TABLE cash_delivery_lines
  DROP CONSTRAINT IF EXISTS chk_delivery_line_amount_pos,
  ADD  CONSTRAINT chk_delivery_line_amount_pos CHECK (amount > 0);

-- ---------------------------------------------
-- cash_delivery_line_denominations
-- ---------------------------------------------

ALTER TABLE cash_delivery_line_denominations
  DROP CONSTRAINT IF EXISTS chk_line_denom_qty_pos,
  ADD  CONSTRAINT chk_line_denom_qty_pos CHECK (quantity > 0);

ALTER TABLE cash_delivery_line_denominations
  DROP CONSTRAINT IF EXISTS chk_line_denom_value_pos,
  ADD  CONSTRAINT chk_line_denom_value_pos CHECK (unit_value > 0);

-- =============================================
-- Invariante 1 (INMEDIATA): la denominación pertenece a la moneda de la línea
-- y unit_value es el snapshot fiel del catálogo.
-- Puede ser inmediata porque ambos padres ya están escritos cuando se inserta
-- la fila de desglose.
-- =============================================

CREATE OR REPLACE FUNCTION trg_line_denomination_currency_check()
RETURNS trigger AS $$
DECLARE
  v_line_currency int;
  v_den_currency  int;
  v_den_value     numeric(20,8);
BEGIN
  SELECT currency_id INTO v_line_currency
    FROM cash_delivery_lines WHERE line_id = NEW.line_id;

  SELECT currency_id, value INTO v_den_currency, v_den_value
    FROM currency_denominations WHERE denomination_id = NEW.denomination_id;

  IF v_line_currency IS DISTINCT FROM v_den_currency THEN
    RAISE EXCEPTION 'err_denomination_currency_mismatch'
      USING DETAIL = format('line=%s line_currency=%s denomination=%s den_currency=%s',
        NEW.line_id, v_line_currency, NEW.denomination_id, v_den_currency);
  END IF;

  IF NEW.unit_value <> v_den_value THEN
    RAISE EXCEPTION 'err_denomination_value_snapshot'
      USING DETAIL = format('denomination=%s catalog=%s written=%s',
        NEW.denomination_id, v_den_value, NEW.unit_value);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cdld_currency_match ON cash_delivery_line_denominations;
CREATE TRIGGER trg_cdld_currency_match
  BEFORE INSERT OR UPDATE ON cash_delivery_line_denominations
  FOR EACH ROW EXECUTE FUNCTION trg_line_denomination_currency_check();

-- =============================================
-- Invariante 2 (DIFERIDA): el desglose cuadra con el monto de la línea.
--
-- DEFERRABLE INITIALLY DEFERRED es obligatorio: la línea se inserta antes que
-- sus N filas de desglose, así que a media transacción el cuadre es falso por
-- construcción. Solo tiene sentido validar en el COMMIT.
--
-- CERO filas de desglose = válido, a propósito: las entregas migradas del
-- modelo viejo nacen sin desglose y deben poder editarse. La obligatoriedad de
-- capturar billetes es una regla de captura (Zod), no un invariante histórico.
-- =============================================

CREATE OR REPLACE FUNCTION assert_delivery_line_breakdown(p_line_id int)
RETURNS void AS $$
DECLARE
  v_amount    numeric(20,8);
  v_breakdown numeric(20,8);
  v_rows      int;
BEGIN
  SELECT amount INTO v_amount FROM cash_delivery_lines WHERE line_id = p_line_id;
  IF NOT FOUND THEN
    RETURN;  -- la línea se borró en esta misma tx (editar = borrar + recrear)
  END IF;

  SELECT COALESCE(SUM(unit_value * quantity), 0), COUNT(*)
    INTO v_breakdown, v_rows
    FROM cash_delivery_line_denominations
   WHERE line_id = p_line_id;

  IF v_rows = 0 THEN
    RETURN;  -- sin desglose: entrega migrada, no se valida cuadre
  END IF;

  IF v_breakdown <> v_amount THEN
    RAISE EXCEPTION 'err_delivery_breakdown_mismatch'
      USING DETAIL = format('line=%s amount=%s breakdown=%s',
        p_line_id, v_amount, v_breakdown);
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_delivery_breakdown_check()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM assert_delivery_line_breakdown(OLD.line_id);
    RETURN OLD;
  END IF;
  PERFORM assert_delivery_line_breakdown(NEW.line_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cdld_breakdown ON cash_delivery_line_denominations;
CREATE CONSTRAINT TRIGGER trg_cdld_breakdown
  AFTER INSERT OR UPDATE OR DELETE ON cash_delivery_line_denominations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_delivery_breakdown_check();

CREATE OR REPLACE FUNCTION trg_delivery_line_amount_check()
RETURNS trigger AS $$
BEGIN
  PERFORM assert_delivery_line_breakdown(NEW.line_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cdl_breakdown ON cash_delivery_lines;
CREATE CONSTRAINT TRIGGER trg_cdl_breakdown
  AFTER INSERT OR UPDATE OF amount ON cash_delivery_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_delivery_line_amount_check();

-- =============================================
-- Invariante 3 (DIFERIDA): toda entrega tiene al menos una línea.
-- Diferida porque el encabezado se inserta antes que sus líneas.
-- =============================================

CREATE OR REPLACE FUNCTION assert_delivery_has_lines(p_delivery_id int)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cash_deliveries WHERE delivery_id = p_delivery_id) THEN
    RETURN;  -- la entrega se eliminó en esta misma tx
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cash_delivery_lines WHERE delivery_id = p_delivery_id) THEN
    RAISE EXCEPTION 'err_delivery_without_lines'
      USING DETAIL = format('delivery=%s', p_delivery_id);
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_delivery_has_lines_check()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM assert_delivery_has_lines(OLD.delivery_id);
    RETURN OLD;
  END IF;
  PERFORM assert_delivery_has_lines(NEW.delivery_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cd_has_lines ON cash_deliveries;
CREATE CONSTRAINT TRIGGER trg_cd_has_lines
  AFTER INSERT ON cash_deliveries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_delivery_has_lines_check();

DROP TRIGGER IF EXISTS trg_cdl_parent_has_lines ON cash_delivery_lines;
CREATE CONSTRAINT TRIGGER trg_cdl_parent_has_lines
  AFTER DELETE ON cash_delivery_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_delivery_has_lines_check();

-- =============================================
-- Índice del feed caliente: comisiones pendientes por mensajero.
-- =============================================

DROP INDEX IF EXISTS cash_deliveries_commission_pending_idx;
CREATE INDEX cash_deliveries_commission_pending_idx
  ON cash_deliveries (courier_id, occurred_at)
  WHERE commission_status = 'pending' AND commission_amount > 0;
