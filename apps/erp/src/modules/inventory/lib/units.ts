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

/**
 * Piezas fungibles totales para una cantidad vendida/comprada en una
 * presentación catch-weight (ej. 2 Caja de 5 piezas = 10 piezas). `quantity`
 * es la cantidad de la presentación (entera, ≥1) y `piecesPerUnit` viene
 * SIEMPRE de `ProductPresentation.piecesPerUnit` (nunca del cliente).
 */
export function piecesFor(quantity: number, piecesPerUnit: number): number {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("La cantidad debe ser un entero mayor o igual a 1");
  }
  if (!Number.isInteger(piecesPerUnit) || piecesPerUnit < 1) {
    throw new Error("Las piezas por unidad deben ser un entero mayor o igual a 1");
  }
  return quantity * piecesPerUnit;
}

/**
 * Cantidad en unidad base (kg) para un producto catch-weight, a partir del
 * peso REAL capturado en báscula — nunca del factor nominal de la
 * presentación, que solo estima. Mismo redondeo a 8 decimales que
 * `toBaseQuantity` para no introducir una segunda fuente de discrepancias.
 */
export function catchWeightBaseQuantity(actualWeightKg: number): number {
  if (!Number.isFinite(actualWeightKg) || actualWeightKg <= 0) {
    throw new Error("El peso capturado debe ser un número finito mayor a 0");
  }
  return Math.round(actualWeightKg * 1e8) / 1e8;
}

/**
 * Texto para UI/kardex de una línea catch-weight: "1 Caja (5 pzas) · 17.35 kg".
 * Si la presentación no agrupa piezas (piecesPerUnit=1, ej. "Pieza"), el
 * conteo de piezas es igual a `quantity` y el paréntesis se omite:
 * "2 Pieza · 6.80 kg". El peso se muestra con hasta 3 decimales, sin ceros
 * de más (17.35, no 17.350).
 */
export function formatCatchWeight(
  quantity: number,
  presentationName: string,
  pieces: number,
  actualWeightKg: number
): string {
  const weight = Number(actualWeightKg.toFixed(3));
  const piecesLabel = pieces === quantity ? "" : ` (${pieces} pzas)`;
  return `${quantity} ${presentationName}${piecesLabel} · ${weight} kg`;
}

/**
 * Display de VENTA de una línea catch-weight (carrito, ticket, factura): solo
 * el peso real y el precio por kg — "17.35 kg × $180.00/kg". El desglose por
 * presentación/piezas queda para inventario (formatCatchWeight), no para el
 * cliente.
 */
export function formatWeightPrice(actualWeightKg: number, pricePerKg: number): string {
  const weight = Number(actualWeightKg.toFixed(3));
  return `${weight} kg × $${pricePerKg.toFixed(2)}/kg`;
}
