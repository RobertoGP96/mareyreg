/**
 * Precio de una pieza pesada: pricePerKg × weightKg redondeado a los decimales
 * de la moneda base. ÚNICA fórmula compartida entre el catálogo
 * (GET /api/webstore/products, campo `price` de cada pieza) y el
 * procesamiento de órdenes (process-order.ts) — así el total facturado
 * coincide exactamente con lo que la tienda mostró al cliente.
 */
export function piecePrice(
  pricePerKg: number,
  weightKg: number,
  decimalPlaces: number
): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(pricePerKg * weightKg * factor) / factor;
}
