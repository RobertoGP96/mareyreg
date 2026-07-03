/** Umbral mínimo de dígitos para considerar un teléfono válido como clave de matching. */
const MIN_DIGITS = 5;

/**
 * Extrae solo los dígitos de un teléfono para usarlo como clave de matching
 * entre registros de la tienda (índice único parcial en `webstore-customers.sql`).
 * Devuelve `null` si no hay suficientes dígitos para ser un teléfono real.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= MIN_DIGITS ? digits : null;
}
