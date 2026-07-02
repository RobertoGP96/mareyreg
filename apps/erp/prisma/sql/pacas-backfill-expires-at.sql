-- Backfill de paca_reservations.expires_at desde el legado expiration_date.
-- `db push` no corre backfills de datos, asi que este script se debe correr
-- manualmente con psql contra la base de datos (Neon).
--
-- NO SE APLICA AUTOMATICAMENTE. Revisar y ejecutar manualmente:
--   psql "$DATABASE_URL" -f prisma/sql/pacas-backfill-expires-at.sql
--
-- Contexto: expiration_date es un String "YYYY-MM-DD" (formato que produce
-- <input type="date"> en el formulario de reservaciones, ver
-- reservation-list-client.tsx). La app interpreta esa fecha como "vencimiento
-- al final del dia LOCAL" (23:59:59.999), NO medianoche UTC — ver
-- src/modules/pacas/lib/reservation-expiration.ts (endOfLocalDay).
--
-- IMPORTANTE sobre zona horaria: este UPDATE construye el timestamp
-- interpretando expiration_date en la zona horaria de la SESION de psql
-- (parametro `timezone`), y expires_at es TIMESTAMP (sin tz) tal como lo
-- espera Prisma para un campo `DateTime` sin @db.Timestamptz. Antes de
-- correr, fijar explicitamente la zona horaria de la sesion a la que usa la
-- app en produccion (America/Mexico_City) para que el backfill coincida con
-- lo que calcula endOfLocalDay() en Node:
--
--   SET TIME ZONE 'America/Mexico_City';
--
-- Si la app corre en otra zona, ajustar el SET TIME ZONE de acuerdo.

SET TIME ZONE 'America/Mexico_City';

-- Solo rellena filas que aun no tienen expires_at y cuyo expiration_date
-- legado es una fecha valida en formato YYYY-MM-DD. No toca filas que ya
-- tienen expires_at (evita pisar datos ya escritos por el dual-write nuevo).
UPDATE paca_reservations
SET expires_at = (
  (expiration_date::date + INTERVAL '1 day')::timestamp - INTERVAL '1 millisecond'
)
WHERE expires_at IS NULL
  AND expiration_date IS NOT NULL
  AND expiration_date ~ '^\d{4}-\d{2}-\d{2}$';

-- Verificacion rapida post-backfill (no destructiva):
-- SELECT reservation_id, expiration_date, expires_at, status
-- FROM paca_reservations
-- WHERE expiration_date IS NOT NULL
-- ORDER BY reservation_id DESC
-- LIMIT 20;
