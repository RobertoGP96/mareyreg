export const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? "SHOP";

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

// Contacto del footer: sin default a propósito. Un teléfono o correo inventado
// en producción es peor que no mostrar el bloque, así que cada dato se pinta
// solo si está configurado.
export const STORE_EMAIL = process.env.NEXT_PUBLIC_STORE_EMAIL ?? "";
export const STORE_PHONE = process.env.NEXT_PUBLIC_STORE_PHONE ?? "";
export const STORE_ADDRESS = process.env.NEXT_PUBLIC_STORE_ADDRESS ?? "";

// El botón de Google solo se ofrece si hay client id. La tienda todavía no
// tiene proveedor OAuth montado (la sesión vive en localStorage), así que este
// flag es lo que separa "el botón está listo" de "el flujo está conectado".
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
