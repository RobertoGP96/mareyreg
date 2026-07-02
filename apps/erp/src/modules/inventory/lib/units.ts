/**
 * Conversión entre presentaciones de venta y unidad base del producto.
 *
 * Regla del sistema: stock, kardex y valuación se llevan SIEMPRE en unidad
 * base. Las cantidades capturadas en una presentación (ej. "2 Caja 24") se
 * convierten aquí, en un único punto, para que el redondeo sea idéntico en
 * ventas, reversas, movimientos y traspasos.
 */

/**
 * Cantidad en unidad base para una cantidad vendida/capturada en presentación.
 * Redondeo a 8 decimales (misma precisión que los Decimal del schema) para
 * eliminar residuos de punto flotante; con cantidades enteras y factores de
 * hasta 4 decimales el resultado es exacto.
 */
export function toBaseQuantity(quantity: number, factor: number): number {
  return Math.round(quantity * factor * 1e8) / 1e8;
}

/**
 * Texto de equivalencia para UI y notas de kardex: "2 Caja 24 = 48 lata".
 * Si la presentación ya es la base (factor 1) no hay nada que aclarar y se
 * devuelve solo "48 lata".
 */
export function formatEquivalence(
  quantity: number,
  factor: number,
  presentationName: string,
  baseUnit: string
): string {
  const baseQty = toBaseQuantity(quantity, factor);
  if (factor === 1) return `${baseQty} ${baseUnit}`;
  return `${quantity} ${presentationName} = ${baseQty} ${baseUnit}`;
}
