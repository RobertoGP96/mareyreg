export const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? "EL ALMACÉN";

// Defaults en CUP (moneda base del ERP): envío gratis desde 63500 (~$100 USD
// a 635 CUP/USD) y costo de envío a domicilio 3200 (~$5 USD). Configurables
// por entorno porque son montos de negocio, no de conversión de moneda — la
// tienda nunca calcula tasas de cambio.
export const FREE_SHIPPING_TARGET = Number(
  process.env.NEXT_PUBLIC_FREE_SHIPPING_TARGET ?? 63500
);
export const SHIPPING_COST = Number(
  process.env.NEXT_PUBLIC_SHIPPING_COST ?? 3200
);
